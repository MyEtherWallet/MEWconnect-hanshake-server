'use strict';

// Import //

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

// Lib //


var _ioredis = require('ioredis');

var _ioredis2 = _interopRequireDefault(_ioredis);

var _logging = require('logging');

var _logging2 = _interopRequireDefault(_logging);

var _config = require('@config');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// RedisClient infoLogger //
var infoLogger = (0, _logging2.default)('Redis');

/*
|--------------------------------------------------------------------------
|
| RedisClient
|
|--------------------------------------------------------------------------
|
| Description coming soon...
|
*/

var RedisClient = function () {
  /**
   * Represents the Redis Client for handling SocketIO Redis (https://www.npmjs.com/package/ioredis)
   * functions for the SignalServer and its socket connections.
   *
   * @param {Object} options - Configuration options for the Redis Client
   *                         - These are typically obtained through config files in @/config
   * @param {String} options.host - Host address of the Redis client
   * @param {String} options.port - Port that the Redis host runs on
   * @param {Integer} options.timeout - Timeout in MS for connection
   * @param {Integer} options.family - IPV4 (4) or IPV6 (6)
   * @param {Integer} options.db - Redis DB to connect to
   */
  function RedisClient() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, RedisClient);

    // Instantiate member variable options //
    this.options = options;

    // Options will either be set in constructor or default to those defined in @/config //
    this.options.host = this.options.host || _config.redisConfig.host;
    this.options.port = this.options.port || _config.redisConfig.port;
    this.options.timeout = this.options.timeout || _config.redisConfig.timeout;
    this.options.family = this.options.family || _config.redisConfig.family;
    this.options.db = this.options.db || _config.redisConfig.db;

    // Initialize additional member variables //
    this.connectionErrorCounter = 0;
  }

  /**
   * Initialize the Redis Client instance with configured options.
   * On asynchronous "ready" event, resolve promise.
   */


  _createClass(RedisClient, [{
    key: 'init',
    value: async function init() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        // Create Redis Client with configured options //
        _this.client = new _ioredis2.default({
          port: _this.options.port,
          host: _this.options.host,
          family: _this.options.family,
          db: _this.options.db
        });

        // On ready, resolve promise //
        _this.client.on('ready', function () {
          infoLogger.info('REDIS READY ');
          resolve();
        });

        // Log client connection //
        _this.client.on('connect', function () {
          infoLogger.info('Client Connected');
        });

        // Log closed connection //
        _this.client.on('end', function () {
          infoLogger.info('connection closed');
        });

        // Terminate process with error if redis server becomes unavailable for too long //
        _this.client.on('error', function (err) {
          if (err.code === 'ECONNREFUSED') {
            if (_this.connectionErrorCounter > 100) {
              infoLogger.error('TERMINATING PROCESS: CONNECTION TO REDIS SERVER REFUSED MORE THAN 100 TIMES');
              process.exit(1);
            }
            _this.connectionErrorCounter++;
          }
          infoLogger.error(err);
        });
      });
    }

    /*
    ===================================================================================
      Member Functions
    ===================================================================================
    */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      this.client.disconnect();
    }
  }, {
    key: 'createConnectionEntry',
    value: async function createConnectionEntry(details, socketId) {
      var connId = details.connId;
      var message = details.message;
      var initialSigned = details.signed;
      var initiator = socketId;
      var requireTurn = false;
      var tryTurnSignalCount = 0;
      var hsetArgs = ['initiator', initiator, 'message', message, 'initialSigned', initialSigned, 'requireTurn', requireTurn, 'tryTurnSignalCount', tryTurnSignalCount];

      try {
        var result = await this.client.hset(connId, hsetArgs);
        await this.client.expire(connId, this.timeout);
        return result;
      } catch (e) {
        infoLogger.error('createConnectionEntry', { e: e });
      }
    }
  }, {
    key: 'locateMatchingConnection',
    value: async function locateMatchingConnection(connId) {
      var result = await this.client.exists(connId);
      return result === 1;
    }
  }, {
    key: 'getConnectionEntry',
    value: async function getConnectionEntry(connId) {
      return this.client.hgetall(connId);
    }
  }, {
    key: 'verifySig',
    value: async function verifySig(connId, sig) {
      try {
        var connectionEntry = this.getConnectionEntry(connId);
        var isVerified = connectionEntry.initialSigned === sig;
        await this.client.hset(connId, 'verified', isVerified);
        return isVerified;
      } catch (e) {
        infoLogger.error('verifySig', { e: e });
        return false;
      }
    }
  }, {
    key: 'updateConnectionEntry',
    value: function updateConnectionEntry(connId, socketId) {
      var _this2 = this;

      try {
        return this.client.hexists(connId, 'receiver').then(function (_result) {
          if (_result === 0) {
            return _this2.client.hset(connId, 'receiver', socketId).then(function () {
              return Promise.resolve(true);
            });
          }
          return false;
        });
      } catch (e) {
        infoLogger.error('updateConnectionEntry', { e: e });
        return false;
      }
    }
  }, {
    key: 'updateTurnStatus',
    value: function updateTurnStatus(connId) {
      var _this3 = this;

      return this.client.hset(connId, 'requireTurn', true).then(function (_response) {
        infoLogger.info(_response);
        return _this3.client.hincrby(connId, 'tryTurnSignalCount', 1);
      });
    }
  }, {
    key: 'removeConnectionEntry',
    value: function removeConnectionEntry(connId) {
      return this.client.hdel(connId, 'initiator', 'receiver', 'initialSigned', 'requireTurn', 'tryTurnSignalCount').then(function (_result) {
        return _result >= 3;
      });
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