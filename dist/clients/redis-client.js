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

    /**
     * Create an entry in Redis when an initiator initially connects, and store
     * information pertinent to matching a valid receiver with said initiator.
     *
     * @param {Object} details - Query payload sent by the initiator on initial connection attempt
     * @param {String} details.signed - Private key signed with the private key created
     *                                  for the connection
     * @param {String} details.connId - Last 32 characters of the public key portion of the key-pair
     *                                  created for the particular paired connection
     * @param {String} socketId - Socket.io socket.id of the initiator
     * @return {Boolean} - True/false if the entry has been successfully created
     */

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

      // Confirm required parameters are assigned //
      if (!connId || !message || !initialSigned || !initiator) {
        return false;
      }

      // Write to Redis and set expiry time //
      try {
        var result = await this.client.hset(connId, hsetArgs);
        await this.client.expire(connId, this.options.timeout);
        return result >= 5;
      } catch (e) {
        infoLogger.error('createConnectionEntry', { e: e });
        return false;
      }
    }

    /**
     * Attempt to locate an existing Redis entry with the key @connId.
     * Returns true/false if found or not.
     *
     * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
     *                           created for the particular paired connection
     * @return {Boolean} - True if connection found, false if not
     */

  }, {
    key: 'locateMatchingConnection',
    value: async function locateMatchingConnection(connId) {
      if (!connId) return false;
      var result = await this.client.exists(connId);
      return result === 1;
    }

    /**
     * Get and return a particular Redis entry with key @connId
     *
     * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
     *                           created for the particular paired connection
     * @return {Object} - The connection entry object created with createConnectionEntry()
     *                    (and possibly modified with updateConnectionEntry())
     */

  }, {
    key: 'getConnectionEntry',
    value: async function getConnectionEntry(connId) {
      if (!connId) return {};
      var result = await this.client.hgetall(connId);
      return result;
    }

    /**
     * Update a Redis entry originally created with createConnectionEntry()
     * with details of the receiver.
     *
     * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
     *                           created for the particular paired connection
     * @param {String} socketId - Socket.io socket.id of the receiver
     * @return {Boolean} - True/false if connection entry has been successfully updated or not
     */

  }, {
    key: 'updateConnectionEntry',
    value: async function updateConnectionEntry(connId, socketId) {
      if (!socketId) return false;

      // Can't update an entry that does not exist! //
      var doesConnectionExist = await this.locateMatchingConnection(connId);
      if (!doesConnectionExist) return false;

      // Update //
      try {
        var receiverExists = await this.client.hexists(connId, 'receiver');
        if (!receiverExists) {
          await this.client.hset(connId, 'receiver', socketId);
          return true;
        }
        return false;
      } catch (e) {
        infoLogger.error('updateConnectionEntry', { e: e });
        return false;
      }
    }

    /**
     * Remove a particular connection entry from Redis.
     *
     * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
     *                           created for the particular paired connection
     * @return {Boolean} - True/false if successfully removed or not
     */

  }, {
    key: 'removeConnectionEntry',
    value: async function removeConnectionEntry(connId) {
      var result = await this.client.hdel(connId, 'initiator', 'receiver', 'initialSigned', 'requireTurn', 'tryTurnSignalCount');
      return result >= 3;
    }

    /**
     * Check if a @sig provided matches the initialSigned property originally created
     * by the initiator with createConnectionEntry() for a particular @connId key.
     *
     * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
     *                           created for the particular paired connection
     * @param  {String} sig - Signature provided (by the receiver). It should be the private key
     *                        signed with the private key created for the connection.
     * @return {[Boolean} - True/false whether or not the initial signature matches that of the
     *                      signature provided by the receiver.
     */

  }, {
    key: 'verifySig',
    value: async function verifySig(connId, sig) {
      try {
        var connectionEntry = await this.getConnectionEntry(connId);
        var isVerified = connectionEntry.initialSigned === sig;
        await this.client.hset(connId, 'verified', isVerified);
        return isVerified;
      } catch (e) {
        infoLogger.error('verifySig', { e: e });
        return false;
      }
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      this.client.disconnect();
    }
  }, {
    key: 'updateTurnStatus',
    value: function updateTurnStatus(connId) {
      var _this2 = this;

      return this.client.hset(connId, 'requireTurn', true).then(function (_response) {
        infoLogger.info(_response);
        return _this2.client.hincrby(connId, 'tryTurnSignalCount', 1);
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