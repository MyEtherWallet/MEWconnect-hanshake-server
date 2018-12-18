'use strict';

// Import //
// todo look into refactoring to accept plug-in testing data, and/or testing tools

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

// Lib //


var _logging = require('logging');

var _logging2 = _interopRequireDefault(_logging);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _util = require('util');

var _socket = require('socket.io-redis');

var _socket2 = _interopRequireDefault(_socket);

var _socket3 = require('socket.io');

var _socket4 = _interopRequireDefault(_socket3);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _validators = require('@helpers/validators');

var _validators2 = _interopRequireDefault(_validators);

var _redisClient = require('@clients/redis-client');

var _redisClient2 = _interopRequireDefault(_redisClient);

var _config = require('@config');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// SignalServer Loggers //
var errorLogger = (0, _logging2.default)('SignalServer:ERROR');
var infoLogger = (0, _logging2.default)('SignalServer:INFO');

// Signal Loggers //
_debug2.default.log = console.log.bind(console);
var initiatorLog = (0, _debug2.default)('signal:initiator');
var receiverLog = (0, _debug2.default)('signal:receiver');
var turnLog = (0, _debug2.default)('signal:turn');
var verbose = (0, _debug2.default)('signal:verbose');
var extraverbose = (0, _debug2.default)('verbose');

var SignalServer = function () {
  /**
   * Represents the "Signal Server" for handling MEWConnect Requests
   * @constructor
   * @param {Object} options - Configuration options for the Signal Server
   *                         - These are typically obtained through config files in @/config
   * @param {Map} options.clients - Map object of connected clients
   * @param {Object} options.server - Configuration pertaining to the HTTP server
   * @param {Object} options.server.host - Host address of the HTTP server
   * @param {Object} options.server.port - Port that the HTTP server will run on
   * @param {Object} options.socket - Configuration pertaining to the socket.io server
   * @param {Object} options.redis - Configuration pertaining to the Redis client
   * @param {Object} options.redis.host - Host address of the Redis client
   * @param {Object} options.redis.port - Port that the Redis host runs on
   */
  function SignalServer() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, SignalServer);

    // Instantiate member variable options //
    this.options = options;

    // Options will either be set in constructor or default to those defined in @/config //
    this.options.server = this.options.server || _config.serverConfig;
    this.options.socket = this.options.socket || _config.socketConfig;
    this.options.redis = this.options.redis || _config.redisConfig;

    // Instantiate synchronous member variables //
    this.clients = this.options.clients || new Map();
    this.host = this.options.server.host;
    this.port = this.options.server.port;

    // Declare asynchronous member variable functions //
    this.server = {};
    this.redis = {};
    this.io = {};
  }

  _createClass(SignalServer, [{
    key: 'init',
    value: async function init() {
      // Create HTTP server //
      this.server = await _http2.default.createServer();

      // Create Redis client with configuration defined in options or @/config //
      this.redis = await new _redisClient2.default(this.options.redis);

      // Promisify server.listen for async/await and listen on configured options //
      var serverPromise = (0, _util.promisify)(this.server.listen).bind(this.server);
      await serverPromise({ host: this.host, port: this.port });
      infoLogger.info('Listening on ' + this.server.address().address + ':' + this.port);

      // Create socket.io connection using socket.io-redis //
      this.io = await (0, _socket4.default)(this.server, this.options.socket);
      this.io.adapter((0, _socket2.default)({
        host: this.options.redis.host,
        port: this.options.redis.port
      }));
      this.io.on(_config.signals.connection, this.ioConnection.bind(this));

      // Ready //
      infoLogger.info('SignalServer Ready!');
    }
  }, {
    key: 'validate',
    value: async function validate(message, next) {
      try {
        await (0, _validators2.default)(message);
        return next();
      } catch (e) {
        return next(new Error('invalid signal or parameters'));
      }
    }
  }, {
    key: 'ioConnection',
    value: function ioConnection(socket) {
      var _this = this;

      try {
        // Use class function validate() middleware //
        socket.use(this.validate.bind(this));

        // Get socket handshake query token //
        var token = socket.handshake.query;
        var stage = token.stage || false;
        var connId = token.connId || false;

        // ERROR: invalid connection id //
        if (this.invalidHex(connId)) throw new Error('Connection attempted to pass an invalid connection ID');

        // Handle connection based on stage provided by token //
        switch (stage) {
          case _config.stages.initiator:
            initiatorLog('Initiator stage identifier recieved');
            this.initiatorIncomming(socket, token);
            break;
          case _config.stages.receiver:
            receiverLog('Receiver stage identifier recieved');
            this.receiverIncomming(socket, token);
            break;
          default:
            errorLogger.error('Invalid Stage Supplied');
            return false;
        }

        // Handle signal "signature" event //
        socket.on(_config.signals.signature, function (data) {
          verbose(_config.signals.signature + ' signal Recieved for ' + data.connId + ' ');
          extraverbose('Recieved: ', _config.signals.signature);
          _this.receiverConfirm(socket, data);
        });

        // Handle signal "offerSignal" event //
        socket.on(_config.signals.offerSignal, function (offerData) {
          verbose(_config.signals.offerSignal + ' signal Recieved for ' + offerData.connId + ' ');
          _this.io.to(offerData.connId).emit(_config.signals.offer, { data: offerData.data });
        });

        // Handle signal "answerSignal" event //
        socket.on(_config.signals.answerSignal, function (answerData) {
          verbose(_config.signals.answerSignal + ' signal Recieved for ' + answerData.connId + ' ');
          _this.io.to(answerData.connId).emit(_config.signals.answer, {
            data: answerData.data,
            options: answerData.options
          });
        });

        // Handle signal "rtcConnected" event //
        socket.on(_config.signals.rtcConnected, function (connId) {
          // Clean up client record
          verbose('Removing connection entry for: ' + connId);
          _this.redis.removeConnectionEntry(connId);
          _this.io.to(connId).emit(_config.signals.rtcEstablished, {
            data: {
              msg: 'WebRTC Connection Established. Goodbye.'
            }
          });
          // socket.leave(connId)
          verbose('WebRTC CONNECTED', connId);
        });

        // Handle signal "disconnect" event //
        socket.on(_config.signals.disconnect, function (reason) {
          verbose('disconnect reason: ', reason);
          socket.disconnect(true);
        });
      } catch (e) {
        errorLogger.error('ioConnection:createTurnConnection', { e: e });
      }
    }
  }, {
    key: 'invalidHex',
    value: function invalidHex(hex) {
      return !/[0-9A-Fa-f].*/.test(hex);
    }

    ////////////////////////////// 

  }, {
    key: 'createTurnConnection',
    value: function createTurnConnection() {
      try {
        turnLog('CREATE TURN CONNECTION');
        var accountSid = process.env.TWILIO;
        var authToken = process.env.TWILIO_TOKEN;
        var ttl = process.env.TWILIO_TTL;
        var client = (0, _twilio2.default)(accountSid, authToken);
        return client.tokens.create({ ttl: ttl });
      } catch (e) {
        errorLogger.error(e);
        return null;
      }
    }
  }, {
    key: 'initiatorIncomming',
    value: function initiatorIncomming(socket, details) {
      try {
        initiatorLog('INITIATOR CONNECTION with connection ID: ' + details.connId);
        extraverbose('Initiator details: ', details);
        if (this.invalidHex(socket.id)) throw new Error('Connection attempted to pass an invalid socket ID');
        this.redis.createConnectionEntry(details, socket.id).then(function () {
          socket.join(details.connId);
          socket.emit(_config.signals.initiated, details);
        });
      } catch (e) {
        errorLogger.error('initiatorIncomming', { e: e });
      }
    }
  }, {
    key: 'receiverIncomming',
    value: function receiverIncomming(socket, details) {
      var _this2 = this;

      try {
        receiverLog('RECEIVER CONNECTION for ' + details.connId);
        if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');

        this.redis.locateMatchingConnection(details.connId).then(function (_result) {
          if (_result) {
            verbose(_result);
            _this2.redis.getConnectionEntry(details.connId).then(function (_result) {
              socket.emit(_config.signals.handshake, { toSign: _result.message });
            });
          } else {
            receiverLog('NO INITIATOR CONNECTION FOUND FOR ' + details.connId);
            socket.emit(_config.signals.invalidConnection);
          }
        });
      } catch (e) {
        errorLogger.error('receiverIncoming', { e: e });
      }
    }
  }, {
    key: 'receiverConfirm',
    value: function receiverConfirm(socket, details) {
      var _this3 = this;

      try {
        receiverLog('RECEIVER CONFIRM: ', details.connId);
        if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
        this.redis.locateMatchingConnection(details.connId).then(function (_result) {
          receiverLog('Located Matching Connection for ' + details.connId);
          verbose(_result);
          if (_result) {
            _this3.redis.verifySig(details.connId, details.signed).then(function (_result) {
              if (_result) {
                socket.join(details.connId);
                receiverLog('PAIR CONNECTION VERIFICATION COMPLETED for ' + details.connId);
                _this3.redis.updateConnectionEntry(details.connId, socket.id).then(function (_result) {
                  if (_result) {
                    receiverLog('Updated connection entry for ' + details.connId);
                    socket.to(details.connId).emit(_config.signals.confirmation, {
                      connId: details.connId,
                      version: details.version
                    });
                  } else {
                    receiverLog('CONFIRMATION FAILED: BUSY for connection ID ' + details.connId);
                    socket.to(details.connId).emit(_config.signals.confirmationFailedBusy);
                  }
                }).catch(function (error) {
                  errorLogger.error('receiverConfirm:updateConnectionEntry', { error: error });
                });
              } else {
                receiverLog('CONNECTION VERIFY FAILED for ' + details.connId);
                socket.emit(_config.signals.confirmationFailed);
              }
            }).catch(function (error) {
              errorLogger.error('receiverConfirm:verifySig', { error: error });
            });
          } else {
            receiverLog('INVALID CONNECTION DETAILS PROVIDED for ' + details.connId);
            socket.emit(_config.signals.invalidConnection);
          }
        }).catch(function (error) {
          errorLogger.error('receiverConfirm:locateMatchingConnection', { error: error });
        });
      } catch (e) {
        errorLogger.error('receiverConfirm', { e: e });
      }
    }
  }]);

  return SignalServer;
}();

exports.default = SignalServer;