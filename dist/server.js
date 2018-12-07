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

var _validators = require('@/validators');

var _validators2 = _interopRequireDefault(_validators);

var _redisClient = require('@/redisClient');

var _redisClient2 = _interopRequireDefault(_redisClient);

var _config = require('@/config');

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
    var _this = this;

    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, SignalServer);

    return async function () {
      // Options will either be set in constructor or default to those defined in @/config //
      options.server = options.server || _config.serverConfig;
      options.socket = options.socket || _config.socketConfig;
      options.redis = options.redis || _config.redisConfig;

      // Create Map of clients //
      _this.clients = options.clients || new Map();

      // Set host/port to those define in options or @/config and create HTTP server //
      _this.port = options.server.port;
      _this.host = options.server.host;
      _this.server = await _http2.default.createServer();

      // Create Redis client with configuration defined in options or @/config //
      _this.redis = await new _redisClient2.default(options.redis);

      // Promisify server.listen for async/await and listen on configured options //
      var serverPromise = (0, _util.promisify)(_this.server.listen).bind(_this.server);
      await serverPromise({ host: _this.host, port: _this.port });
      infoLogger.info('Listening on ' + _this.server.address().address + ':' + _this.port);

      // Create socket.io connection using socket.io-redis //
      _this.io = await (0, _socket4.default)(_this.server, options.socket);
      _this.io.adapter((0, _socket2.default)({
        host: options.redis.host,
        port: options.redis.port
      }));
      _this.io.on(_config.signal.connection, _this.ioConnection.bind(_this));

      // Return SignalServer after successful asynchronous instantiation //
      return _this;
    }();
  }

  _createClass(SignalServer, [{
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
      var _this2 = this;

      try {
        // Use class function validate() middleware //
        socket.use(this.validate.bind(this));

        // Get socket handshake query token //
        var token = socket.handshake.query;
        var stage = token.stage || false;
        var connId = token.connId || false;

        // ERROR: invalid connection id //
        if (this.isInvalidHex(connId)) throw new Error('Connection attempted to pass an invalid connection ID');

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
        socket.on(_config.signal.signature, function (data) {
          verbose(_config.signal.signature + ' signal Recieved for ' + data.connId + ' ');
          extraverbose('Recieved: ', _config.signal.signature);
          _this2.receiverConfirm(socket, data);
        });

        // Handle signal "offerSignal" event //
        socket.on(_config.signal.offerSignal, function (offerData) {
          verbose(_config.signal.offerSignal + ' signal Recieved for ' + offerData.connId + ' ');
          _this2.io.to(offerData.connId).emit(_config.signal.offer, { data: offerData.data });
        });

        // Handle signal "answerSignal" event //
        socket.on(_config.signal.answerSignal, function (answerData) {
          verbose(_config.signal.answerSignal + ' signal Recieved for ' + answerData.connId + ' ');
          _this2.io.to(answerData.connId).emit(_config.signal.answer, {
            data: answerData.data,
            options: answerData.options
          });
        });

        socket.on(_config.signal.rtcConnected, function (connId) {
          // Clean up client record
          verbose('Removing connection entry for: ' + connId);
          _this2.redis.removeConnectionEntry(connId);
          socket.leave(connId);
          verbose('WebRTC CONNECTED', connId);
        });

        socket.on(_config.signal.disconnect, function (reason) {
          verbose('disconnect reason: ', reason);
          socket.disconnect(true);
        });
      } catch (e) {
        errorLogger.error('ioConnection:createTurnConnection', { e: e });
      }
    }
  }, {
    key: 'isInvalidHex',
    value: function isInvalidHex(hex) {
      return !/[0-9A-Fa-f].*/.test(hex);
    }
  }]);

  return SignalServer;
}();

exports.default = SignalServer;