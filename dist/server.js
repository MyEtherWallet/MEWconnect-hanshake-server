'use strict';

// Import //
// todo look into refactoring to accept plug-in testing data, and/or testing tools

Object.defineProperty(exports, "__esModule", {
  value: true
});

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

// Lib //


// Loggers //
var errorLogger = (0, _logging2.default)('SignalServer:ERROR');
var infoLogger = (0, _logging2.default)('SignalServer:INFO');

var SignalServer =
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

    // this.io.on(signal.connection, this.ioConnection.bind(this))

    // Return SignalServer after successful asynchronous instantiation //
    return _this;
  }();
};

exports.default = SignalServer;