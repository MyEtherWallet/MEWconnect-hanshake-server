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
// const extraverbose = debug('verbose')

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
   *
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
      Connection Middleware
    ===================================================================================
    */

    /**
     * Validate that an incoming signal from a client
     * has the necessary and correctly-formatted parameters
     *
     * @param  {Object} message - Client signal/message payload
     * @param  {Function} next - Socket.IO middleware continue function (required)
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

    /**
     * Middleware to handle the initial socket on "connection" event from a client.
     *
     * 1. Validate signal parameters
     * 2. Identify client as a "initiatior" or "receiver" depending
     *    on their handshake.query parameters
     * 3. Bind events to handle each signal request from a client
     */

  }, {
    key: 'ioConnection',
    value: function ioConnection(socket) {
      try {
        // Use class function validate() middleware //
        socket.use(this.validateSignal.bind(this));

        // Socket handshake query //
        var details = socket.handshake.query;
        var stage = details.stage || false;
        var connId = details.connId || false;

        // Ensure valid connId //
        if (!(0, _validation.validConnId)(connId)) {
          throw new Error('Connection attempted to pass an invalid connId');
        }

        // Handle connection based on stage provided by query details //
        switch (stage) {
          case _config.stages.initiator:
            initiatorLog('Initiator stage identifier recieved');
            this.handleInitiator(socket, details);
            break;
          case _config.stages.receiver:
            receiverLog('Receiver stage identifier recieved');
            this.handleReceiver(socket, details);
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
      Client Initialization Functions
    ===================================================================================
    */

    /**
     * Initialize a socket.io channel/redis entry with details provided by the initiator.
     *
     * @param {Object} socket - Client's socket connection object
     * @param {Object} details - Socket handshake query details provided by the initiator
     * @return {Event} signals.initiated - Event confirming that channel creation has been successful.
     */

  }, {
    key: 'handleInitiator',
    value: function handleInitiator(socket, details) {
      try {
        initiatorLog('INITIATOR CONNECTION with connection ID: ' + details.connId);

        // Ensure valid socket id and @signed parameter is included //
        if (!(0, _validation.validHex)(socket.id)) {
          throw new Error('Connection attempted to pass an invalid socket ID');
        }
        if (!details.signed) {
          throw new Error('Connection attempt missing a valid signed parameter');
        }

        // Create redis entry for socket connection and emit "initiated" event when complete //
        this.redis.createConnectionEntry(details, socket.id).then(function () {
          socket.join(details.connId);
          socket.emit(_config.signals.initiated, details);
        });
      } catch (e) {
        errorLogger.error('handleInitiator', { e: e });
      }
    }

    /**
     * Locate matching initiator socket.io channel/redis entry with details provided by the receiver.
     * This does not connect the receiver to the channel created by the initiator. The receiver
     * must successfully verify the signature emitted by this function in order to connect.
     *
     * @param {Object} socket - Client's socket connection object
     * @param {Object} details - Socket handshake query details provided by the receiver
     * @return {Event} signals.handshake - Event/data payload to be handled by the receiver.
     */

  }, {
    key: 'handleReceiver',
    value: function handleReceiver(socket, details) {
      var _this = this;

      try {
        receiverLog('RECEIVER CONNECTION for ' + details.connId);

        // Ensure valid socket id and @signed parameter is included //
        if (!(0, _validation.validHex)(socket.id)) {
          throw new Error('Connection attempted to pass an invalid socket ID');
        }
        if (!details.signed) {
          throw new Error('Connection attempt missing a valid signed parameter');
        }

        // Find matching connection pair for a @connId and emit handshake signal //
        this.redis.locateMatchingConnection(details.connId).then(function (result) {
          if (result) {
            verbose(result);
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

    /*
    ===================================================================================
      Socket Events
    ===================================================================================
    */

    /**
     * Identity confirmation credentials supplied to server for validation against credentials
     * initially supplied to the server by the initiator
     *
     * @param {Object} socket - Client's socket connection object
     * @param {Object} data - Message payload sent by client
     * @param {String} data.signed - Private key signed with the private key created
     *                               for the connection
     * @param {String} data.connId - Last 32 characters of the public key portion of the key-pair
     *                               created for the particular paired connection
     * @param {Object} data.version - Version-string encrypted object using eccrypto
     */

  }, {
    key: 'onSignature',
    value: function onSignature(socket, data) {
      verbose(_config.signals.signature + ' signal Recieved for ' + data.connId + ' ');
      socket.emit(_config.signals.receivedSignal, _config.signals.signature);
      this.receiverConfirm(socket, data);
    }

    /**
     * Initiator sends an encrypted webRTC connection offer to be retransmitted to the receiver
     *
     * @param {Object} socket - Client's socket connection object
     * @param {Object} data - Message payload sent by client
     * @param {String} data.data - Encrypted WebRTC offer object using eccrypto
     *                             as string (Stringified JSON)
     * @param {String} data.connId - Last 32 characters of the public key portion of the key-pair
     *                               created for the particular paired connection
     * @param {Array} data.options - JSONArray of STUN or TURN server details (not encrypted)
     *                               STUN server format: [{url: “details”}, ...]
     *                               TURN server format: [{url: “url”,
     *                               username: “username”, credential: “credential”}, ...]
     */

  }, {
    key: 'onOfferSignal',
    value: function onOfferSignal(socket, data) {
      verbose(_config.signals.offerSignal + ' signal Recieved for ' + data.connId + ' ');
      socket.emit(_config.signals.receivedSignal, _config.signals.offerSignal);
      this.io.to(data.connId).emit(_config.signals.offer, { data: data.data });
    }

    /**
     * Receiver sends webRTC connection answer to be retransmitted to the initiator
     *
     * @param {Object} socket - Client's socket connection object
     * @param {Object} data - Message payload sent by client
     * @param {String} data.data - Encrypted WebRTC answer object using eccrypto
     *                             as string (Stringified JSON)
     * @param {String} data.connId - Last 32 characters of the public key portion of the key-pair
     *                               created for the particular paired connection
     */

  }, {
    key: 'onAnswerSignal',
    value: function onAnswerSignal(socket, data) {
      verbose(_config.signals.answerSignal + ' signal Recieved for ' + data.connId + ' ');
      socket.emit(_config.signals.receivedSignal, _config.signals.answerSignal);
      this.io.to(data.connId).emit(_config.signals.answer, {
        data: data.data,
        options: data.options
      });
    }

    /**
     * Initiator and receiver send confirmation that they have both connected via webRTC,
     * in order for their socket.io pairing to be cleaned up. Since they are both connected via
     * a peer-to-peer connection, the SignalServer is no longer required.
     *
     * @param {Object} socket - Client's socket connection object
     * @param {String} connId - Message payload sent by client.
     *                          In this case, it is the @connId:
     *                          Last 32 characters of the public key portion of the key-pair
     *                          created for the particular paired connection
     */

  }, {
    key: 'onRtcConnected',
    value: function onRtcConnected(socket, connId) {
      verbose('Removing connection entry for: ' + connId);
      socket.emit(_config.signals.receivedSignal, _config.signals.rtcConnected);
      this.redis.removeConnectionEntry(connId);
      verbose('WebRTC connected', connId);
    }

    /**
     * Log client disconnect
     *
     * @param {Object} socket - Client's socket connection object
     * @param {String} data - Reason for disconnect
     */

  }, {
    key: 'onDisconnect',
    value: function onDisconnect(socket, data) {
      verbose('Disconnect reason: ', data);
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
    key: 'receiverConfirm',
    value: function receiverConfirm(socket, details) {
      var _this2 = this;

      try {
        receiverLog('RECEIVER CONFIRM: ', details.connId);
        if (!(0, _validation.validConnId)(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
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

  }]);

  return SignalServer;
}();

exports.default = SignalServer;