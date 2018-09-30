'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ioredis = require('ioredis');

var _ioredis2 = _interopRequireDefault(_ioredis);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _logging = require('logging');

var _logging2 = _interopRequireDefault(_logging);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var logger = (0, _logging2.default)('Redis');

_dotenv2.default.config();

var RedisClient = function () {
  function RedisClient(options) {
    var _this = this;

    _classCallCheck(this, RedisClient);

    this.connectionErrorCounter = 0;
    this.options = options || {};
    this.timeout = this.options.timeout ? this.options.timeout : process.env.CONNECTION_TIMEOUT || 60;
    logger.info('Redis Timeout: ' + this.timeout + ' seconds');
    this.client = new _ioredis2.default({
      port: this.options.port || 6379, // Redis port
      host: this.options.host || '127.0.0.1', // Redis host
      family: this.options.family || 4, // 4 (IPv4) or 6 (IPv6)
      db: this.options.db || 0
    });

    this.client.on('ready', function () {
      logger.info('REDIS READY ');
    });
    this.client.on('error', function (err) {
      if (err.code === 'ECONNREFUSED') {
        // Terminate process with error if redis server becomes unavailable for too long
        if (_this.connectionErrorCounter > 100) {
          logger.error('TERMINATING PROCESS: CONNECTION TO REDIS SERVER REFUSED MORE THAN 100 TIMES');
          process.exit(1);
        }
        _this.connectionErrorCounter++;
      }
      logger.error(err);
    });
    this.client.on('connect', function () {
      logger.info('Client Connected');
    });
    this.client.on('end', function () {
      logger.info('connection closed');
    });
  }

  _createClass(RedisClient, [{
    key: 'disconnect',
    value: function disconnect() {
      this.client.disconnect();
    }
  }, {
    key: 'createConnectionEntry',
    value: function createConnectionEntry(details, socketId) {
      var _this2 = this;

      var connId = details.connId;
      var message = details.message;
      var initialSigned = details.signed;
      var initiator = socketId;
      var requireTurn = false;
      var tryTurnSignalCount = 0;
      var hsetArgs = ['initiator', initiator, 'message', message, 'initialSigned', initialSigned, 'requireTurn', requireTurn, 'tryTurnSignalCount', tryTurnSignalCount];

      return this.client.hset(connId, hsetArgs).then(function (_result) {
        _this2.client.expire(connId, _this2.timeout).then(function () {
          return _result;
        }).catch(function (error) {
          logger.error('createConnectionEntry', { error: error });
        });
      });
    }
  }, {
    key: 'verifySig',
    value: function verifySig(connId, sig) {
      var _this3 = this;

      return this.client.hgetall(connId).then(function (_result) {
        if ((typeof _result === 'undefined' ? 'undefined' : _typeof(_result)) === 'object') {
          if (_result.initialSigned === sig) {
            return _this3.client.hset(connId, 'verified', true).then(function () {
              return Promise.resolve(true);
            });
          }
          return false;
        }
        return false;
      });
    }
  }, {
    key: 'locateMatchingConnection',
    value: function locateMatchingConnection(connId) {
      return this.client.exists(connId).then(function (_result) {
        return _result === 1;
      });
    }
  }, {
    key: 'updateConnectionEntry',
    value: function updateConnectionEntry(connId, socketId) {
      var _this4 = this;

      try {
        return this.client.hexists(connId, 'receiver').then(function (_result) {
          if (_result === 0) {
            return _this4.client.hset(connId, 'receiver', socketId).then(function () {
              return Promise.resolve(true);
            });
          }
          return false;
        });
      } catch (e) {
        logger.error('updateConnectionEntry', { e: e });
        return false;
      }
    }
  }, {
    key: 'updateTurnStatus',
    value: function updateTurnStatus(connId) {
      var _this5 = this;

      return this.client.hset(connId, 'requireTurn', true).then(function (_response) {
        logger.info(_response);
        return _this5.client.hincrby(connId, 'tryTurnSignalCount', 1);
      });
    }
  }, {
    key: 'removeConnectionEntry',
    value: function removeConnectionEntry(connId) {
      return this.client.hdel(connId, 'initiator', 'receiver', 'initialSigned', 'requireTurn', 'tryTurnSignalCount').then(function (_result) {
        return _result >= 3;
      });
    }
  }, {
    key: 'getConnectionEntry',
    value: function getConnectionEntry(connId) {
      return this.client.hgetall(connId);
    }

    // Expose the Underlying Redis Client

  }, {
    key: 'getClient',
    value: function getClient() {
      return this.client;
    }
  }, {
    key: 'hset',
    value: function hset(identifier, requestedBlockNumber, clonedValue) {
      return this.client.hset(identifier, 'blockNumber', requestedBlockNumber, 'result', JSON.stringify(clonedValue));
    }
  }, {
    key: 'hsetExpires',
    value: function hsetExpires(identifier, requestedBlockNumber, clonedValue, time) {
      return this.client.hset(requestedBlockNumber, identifier, JSON.stringify(clonedValue), 'EX', time);
    }
  }, {
    key: 'hgetall',
    value: function hgetall(identifier) {
      return this.client.hgetall(identifier);
    }
  }, {
    key: 'hdel',
    value: function hdel(previousHex, key) {
      return this.client.hdel(previousHex, key);
    }
  }]);

  return RedisClient;
}();

exports.default = RedisClient;