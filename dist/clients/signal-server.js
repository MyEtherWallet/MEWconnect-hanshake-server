'use strict';

// Import //

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

// Lib //
// import validator from '@helpers/validators'


var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _logging = require('logging');

var _logging2 = _interopRequireDefault(_logging);

var _util = require('util');

var _socket = require('socket.io-redis');

var _socket2 = _interopRequireDefault(_socket);

var _socket3 = require('socket.io');

var _socket4 = _interopRequireDefault(_socket3);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _redisClient = require('@clients/redis-client');

var _redisClient2 = _interopRequireDefault(_redisClient);

var _config = require('@config');

var _validation = require('@helpers/validation');

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

/*
|--------------------------------------------------------------------------
|
| SignalServer
|
|--------------------------------------------------------------------------
|
| The SignalServer attempts to pair two "signaling" peers together via a secure Socket.io connection.
| These peers will then establish a webRTC connection to each other, allowing
| secure communication using the credentials created during the pairing process.
|
| The SignalServer performs the "pairing" process defined in the following documentation outline:
| https://docs.google.com/document/d/19acrYB3iLT4j9JDg0xGcccLXFenqfSlNiKVpXOdLL6Y
|
*/

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

  /**
   * Initialize the SignalServer instance.
   *
   * 1. Initialize HTTP Server
   * 2. Initialize Redis Client
   * 3. Initialize SocketIO server
   * 4. Connect Redis Adapter
   * 5. Bind SocketIO on-connection middleware
   */


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

    /*
    ===================================================================================
      "Middlewares"
    ===================================================================================
    */

    /**
     * Middleware to handle the initial socket on "connection" event from a client.
     * 1. Validate signal parameters
     * 2. Identify client as a "initiatior" or "receiver" depending on their handshake.query parameters
     * 3. Bind events to handle each signal request from a client
     */

  }, {
    key: 'ioConnection',
    value: function ioConnection(socket) {
      try {
        // Use class function validate() middleware //
        socket.use(this.validateSignal.bind(this));

        // Get socket handshake query token //
        var token = socket.handshake.query;
        var stage = token.stage || false;
        var connId = token.connId || false;

        // ERROR: invalid connId//
        if (this.invalidConnId(connId)) {
          throw new Error('Connection attempted to pass an invalid connId');
        }

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

        // Bind socket events //
        socket.on(_config.signals.signature, this.onSignature.bind(this, socket));
        socket.on(_config.signals.offerSignal, this.onOfferSignal.bind(this, socket));
        socket.on(_config.signals.answerSignal, this.onAnswerSignal.bind(this, socket));
        socket.on(_config.signals.rtcConnected, this.onRtcConnected.bind(this, socket));
        socket.on(_config.signals.disconnect, this.onDisconnect.bind(this, socket));
      } catch (e) {
        errorLogger.error('ioConnection', { e: e });
      }
    }

    /*
    ===================================================================================
      Socket Events
    ===================================================================================
    */

  }, {
    key: 'onSignature',
    value: function onSignature(socket, data) {
      console.log('SIGNATURE', data);
      verbose(_config.signals.signature + ' signal Recieved for ' + data.connId + ' ');
      socket.emit(_config.signals.receivedSignal, _config.signals.signature);
      this.receiverConfirm(socket, data);
    }
  }, {
    key: 'onOfferSignal',
    value: function onOfferSignal(socket, data) {
      console.log('OFFER', data);
      verbose(_config.signals.offerSignal + ' signal Recieved for ' + data.connId + ' ');
      socket.emit(_config.signals.receivedSignal, _config.signals.offerSignal);
      this.io.to(data.connId).emit(_config.signals.offer, { data: data.data });
    }
  }, {
    key: 'onAnswerSignal',
    value: function onAnswerSignal(socket, data) {
      console.log('ANSWER', data);
      verbose(_config.signals.answerSignal + ' signal Recieved for ' + data.connId + ' ');
      socket.emit(_config.signals.receivedSignal, _config.signals.answerSignal);
      this.io.to(data.connId).emit(_config.signals.answer, {
        data: data.data,
        options: data.options
      });
    }
  }, {
    key: 'onRtcConnected',
    value: function onRtcConnected(socket, data) {
      console.log('RTC', data);
      verbose('Removing connection entry for: ' + data);
      socket.emit(_config.signals.receivedSignal, _config.signals.rtcConnected);
      this.redis.removeConnectionEntry(data);
      verbose('WebRTC connected', data);
    }
  }, {
    key: 'onDisconnect',
    value: function onDisconnect(socket, data) {
      verbose('disconnect reason: ', data);
      socket.disconnect(true);
    }

    /*
    ===================================================================================
      Member Functions
    ===================================================================================
    */

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
        if (!details.signed) throw new Error('Connection attempt missing a valid signed parameter');
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
      var _this = this;

      try {
        receiverLog('RECEIVER CONNECTION for ' + details.connId);
        if (!details.signed) throw new Error('Connection attempt missing a valid signed parameter');
        if (this.invalidConnId(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
        this.redis.locateMatchingConnection(details.connId).then(function (_result) {
          if (_result) {
            verbose(_result);
            _this.redis.getConnectionEntry(details.connId).then(function (_result) {
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
      var _this2 = this;

      try {
        receiverLog('RECEIVER CONFIRM: ', details.connId);
        if (this.invalidConnId(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
        this.redis.locateMatchingConnection(details.connId).then(function (_result) {
          receiverLog('Located Matching Connection for ' + details.connId);
          verbose(_result);
          if (_result) {
            _this2.redis.verifySig(details.connId, details.signed).then(function (_result) {
              if (_result) {
                socket.join(details.connId);
                receiverLog('PAIR CONNECTION VERIFICATION COMPLETED for ' + details.connId);
                _this2.redis.updateConnectionEntry(details.connId, socket.id).then(function (_result) {
                  if (_result) {
                    receiverLog('Updated connection entry for ' + details.connId);
                    _this2.io.to(details.connId).emit(_config.signals.confirmation, {
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
          errorLogger.error('receiverConfirm:locateMatchingConnection', {
            error: error
          });
        });
      } catch (e) {
        errorLogger.error('receiverConfirm', { e: e });
      }
    }

    /*
    ===================================================================================
      Validation
    ===================================================================================
    */

  }, {
    key: 'validateSignal',
    value: async function validateSignal(message, next) {
      try {
        await (0, _validation.validateSignal)(message);
        return next();
      } catch (e) {
        return next(new Error('invalid signal or parameters'));
      }
    }
  }, {
    key: 'invalidConnId',
    value: function invalidConnId(hex) {
      var validHex = /[0-9A-Fa-f].*/.test(hex);
      var validLength = hex.length === 32;
      var result = !(validHex && validLength);
      // console.log(result)
      return result;
    }
  }, {
    key: 'invalidHex',
    value: function invalidHex(hex) {
      var validHex = /[0-9A-Fa-f].*/.test(hex);
      return !validHex;
    }
  }]);

  return SignalServer;
}();

exports.default = SignalServer;