'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // todo look into refactoring to accept plug-in testing data, and/or testing tools


var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _logging = require('logging');

var _logging2 = _interopRequireDefault(_logging);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _socket = require('socket.io');

var _socket2 = _interopRequireDefault(_socket);

var _socket3 = require('socket.io-redis');

var _socket4 = _interopRequireDefault(_socket3);

var _redisClient = require('./redisClient');

var _redisClient2 = _interopRequireDefault(_redisClient);

var _config = require('./config');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

_dotenv2.default.config();

var errorLogger = (0, _logging2.default)('SignalServer:ERROR');
var infoLogger = (0, _logging2.default)('SignalServer:INFO');

_debug2.default.log = console.log.bind(console);
var initiatorLog = (0, _debug2.default)('signal:initiator');
var receiverLog = (0, _debug2.default)('signal:receiver');
var turnLog = (0, _debug2.default)('signal:turn');
var verbose = (0, _debug2.default)('signal:verbose');
var extraverbose = (0, _debug2.default)('verbose');

var SignalServer = function () {
  function SignalServer() {
    var _this = this;

    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, SignalServer);

    options.server = options.server || {};
    options.redis = options.redis || {};
    this.clients = options.clients || new Map();
    this.port = options.server.port || _config.server.port;
    this.host = options.server.host || _config.server.host;

    this.server = _http2.default.createServer();

    var redisOptions = options.redis.port ? options.redis : _config.redis;
    this.redis = new _redisClient2.default(redisOptions);

    this.io = (0, _socket2.default)(this.server, options.socket || _config.socket);
    if (options.redis) this.io.adapter((0, _socket4.default)({
      host: options.redis.host || _config.redis.host,
      port: options.redis.port || _config.redis.port
    }));
    this.server.listen({ host: this.host, port: this.port }, function () {
      infoLogger.info('Listening on ' + _this.server.address().address + ':' + _this.port);
    });

    this.io.on(_config.signal.connection, this.ioConnection.bind(this));
  }

  _createClass(SignalServer, [{
    key: 'createTurnConnection',
    value: function createTurnConnection() {
      try {
        turnLog('CREATE TURN CONNECTION');
        var accountSid = process.env.TWILIO;
        var authToken = process.env.TWILLO_TOKEN;
        var client = (0, _twilio2.default)(accountSid, authToken);
        return client.tokens.create();
      } catch (e) {
        errorLogger.error(e);
        return null;
      }
    }
  }, {
    key: 'invalidHex',
    value: function invalidHex(hex) {
      return !/[0-9A-Fa-f].*/.test(hex);
    }
  }, {
    key: 'initiatorIncomming',
    value: function initiatorIncomming(socket, details) {
      try {
        initiatorLog('INITIATOR CONNECTION with connection ID: ' + details.connId);
        extraverbose('Iniator details: ', details);
        if (this.invalidHex(socket.id)) throw new Error('Connection attempted to pass an invalid socket ID');
        this.redis.createConnectionEntry(details, socket.id).then(function () {
          socket.join(details.connId);
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
              socket.emit(_config.signal.handshake, { toSign: _result.message });
            });
          } else {
            receiverLog('NO INITIATOR CONNECTION FOUND FOR ' + details.connId);
            socket.emit(_config.signal.invalidConnection);
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
                    socket.to(details.connId).emit(_config.signal.confirmation, {
                      connId: details.connId,
                      version: details.version
                    });
                  } else {
                    receiverLog('CONFIRMATION FAILED: BUSY for connection ID ' + details.connId);
                    socket.to(details.connId).emit(_config.signal.confirmationFailedBusy);
                  }
                }).catch(function (error) {
                  errorLogger.error('receiverConfirm:updateConnectionEntry', { error: error });
                });
              } else {
                receiverLog('CONNECTION VERIFY FAILED for ' + details.connId);
                socket.emit(_config.signal.confirmationFailed);
              }
            }).catch(function (error) {
              errorLogger.error('receiverConfirm:verifySig', { error: error });
            });
          } else {
            receiverLog('INVALID CONNECTION DETAILS PROVIDED for ' + details.connId);
            socket.emit(_config.signal.invalidConnection);
          }
        }).catch(function (error) {
          errorLogger.error('receiverConfirm:locateMatchingConnection', { error: error });
        });
      } catch (e) {
        errorLogger.error('receiverConfirm', { e: e });
      }
    }
  }, {
    key: 'ioConnection',
    value: function ioConnection(socket) {
      var _this4 = this;

      try {
        var token = socket.handshake.query;
        var connector = token.stage || false;
        if (this.invalidHex(token.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
        switch (connector) {
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
            return;
        }

        socket.on(_config.signal.signature, function (data) {
          verbose(_config.signal.signature + ' signal Recieved for ' + data.connId + ' ');
          extraverbose('Recieved: ', _config.signal.signature);
          _this4.receiverConfirm(socket, data);
        });

        socket.on(_config.signal.offerSignal, function (offerData) {
          verbose(_config.signal.offerSignal + ' signal Recieved for ' + offerData.connId + ' ');
          _this4.io.to(offerData.connId).emit(_config.signal.offer, { data: offerData.data });
        });

        socket.on(_config.signal.answerSignal, function (answerData) {
          verbose(_config.signal.answerSignal + ' signal Recieved for ' + answerData.connId + ' ');
          _this4.io.to(answerData.connId).emit(_config.signal.answer, { data: answerData.data });
        });

        socket.on(_config.signal.rtcConnected, function (connId) {
          // Clean up client record
          verbose('Removing connection entry for: ' + connId);
          _this4.redis.removeConnectionEntry(connId);
          socket.leave(connId);
          verbose('WebRTC CONNECTED', connId);
        });

        socket.on(_config.signal.disconnect, function (reason) {
          verbose('disconnect reason: ', reason);
          socket.disconnect(true);
        });

        socket.on(_config.signal.tryTurn, function (connData) {
          turnLog(_config.signal.tryTurn + ' signal Recieved for ' + connData.connId + ' ');
          _this4.io.to(connData.connId).emit(_config.signal.attemptingTurn, { data: null });

          _this4.redis.locateMatchingConnection(connData.connId).then(function (_result) {
            if (_result) {
              // Catch error in getting turn credentials
              try {
                turnLog('Update TURN status for ' + connData.connId);
                _this4.redis.updateTurnStatus(connData.connId);
                _this4.createTurnConnection().then(function (_results) {
                  turnLog('Turn Credentials Retrieved for ' + connData.connId);
                  _this4.io.to(connData.connId).emit(_config.signal.turnToken, { data: _results.iceServers });
                  turnLog('ice servers returned. token.iceServers: ' + _results.iceServers);
                }).catch(function (error) {
                  turnLog('Error: createTurnConnectionr ' + connData.connId + ' ');
                  errorLogger.error('ioConnection:createTurnConnection', { error: error });
                });
              } catch (e) {
                errorLogger.error('ioConnection:createTurnConnection', { e: e });
              }
            } else {
              errorLogger.error(' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT');
              turnLog('Failed to locate matching connection for TURN connection attempt with connection ID ' + connData.connId);
            }
          }).catch(function (_error) {
            errorLogger.error('Error locateMatchingConnection \n', _error);
            turnLog('locateMatchingConnection threw an error looking for connection ID: ' + connData.connId);
          });
        });
      } catch (e) {
        errorLogger.error('ioConnection:createTurnConnection', { e: e });
      }
    }
  }], [{
    key: 'create',
    value: function create(options) {
      // if no options object is provided then the options set in the config are used
      return new SignalServer(options);
    }
  }]);

  return SignalServer;
}();

exports.default = SignalServer;