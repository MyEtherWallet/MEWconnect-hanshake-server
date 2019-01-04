'use strict'

// Import //
import Redis from 'ioredis'
import logger from 'logging'

// Lib //
import { redisConfig } from '@config'

// RedisClient infoLogger //
const infoLogger = logger('Redis')

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

export default class RedisClient {
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
  constructor (options = {}) {
    // Instantiate member variable options //
    this.options = options

    // Options will either be set in constructor or default to those defined in @/config //
    this.options.host = this.options.host || redisConfig.host
    this.options.port = this.options.port || redisConfig.port
    this.options.timeout = this.options.timeout || redisConfig.timeout
    this.options.family = this.options.family || redisConfig.family
    this.options.db = this.options.db || redisConfig.db

    // Initialize additional member variables //
    this.connectionErrorCounter = 0
  }

  /**
   * Initialize the Redis Client instance with configured options.
   * On asynchronous "ready" event, resolve promise.
   */
  async init () {
    return new Promise((resolve, reject) => {
      // Create Redis Client with configured options //
      this.client = new Redis({
        port: this.options.port,
        host: this.options.host,
        family: this.options.family,
        db: this.options.db
      })

      // On ready, resolve promise //
      this.client.on('ready', () => {
        infoLogger.info('REDIS READY ')
        resolve()
      })

      // Log client connection //
      this.client.on('connect', () => {
        infoLogger.info('Client Connected')
      })

      // Log closed connection //
      this.client.on('end', () => {
        infoLogger.info('connection closed')
      })

      // Terminate process with error if redis server becomes unavailable for too long //
      this.client.on('error', err => {
        if (err.code === 'ECONNREFUSED') {
          if (this.connectionErrorCounter > 100) {
            infoLogger.error(
              'TERMINATING PROCESS: CONNECTION TO REDIS SERVER REFUSED MORE THAN 100 TIMES'
            )
            process.exit(1)
          }
          this.connectionErrorCounter++
        }
        infoLogger.error(err)
      })
    })
  }

  /*
  ===================================================================================
    Member Functions
  ===================================================================================
  */

  disconnect () {
    this.client.disconnect()
  }

  async createConnectionEntry (details, socketId) {
    const connId = details.connId
    const message = details.message
    const initialSigned = details.signed
    const initiator = socketId
    const requireTurn = false
    const tryTurnSignalCount = 0
    const hsetArgs = [
      'initiator',
      initiator,
      'message',
      message,
      'initialSigned',
      initialSigned,
      'requireTurn',
      requireTurn,
      'tryTurnSignalCount',
      tryTurnSignalCount
    ]

    try {
      let result = await this.client.hset(connId, hsetArgs)
      await this.client.expire(connId, this.timeout)
      return result
    } catch (e) {
      infoLogger.error('createConnectionEntry', { e })
    }
  }

  async locateMatchingConnection (connId) {
    let result = await this.client.exists(connId)
    return result === 1
  }

  async getConnectionEntry (connId) {
    return this.client.hgetall(connId)
  }

  async verifySig (connId, sig) {
    try {
      let connectionEntry = this.getConnectionEntry(connId)
      let isVerified = (connectionEntry.initialSigned === sig)
      await this.client.hset(connId, 'verified', isVerified)
      return isVerified
    } catch (e) {
      infoLogger.error('verifySig', { e })
      return false
    }
  }

  // verifySig (connId, sig) {
  //   return this.client.hgetall(connId).then(_result => {
  //     if (typeof _result === 'object') {
  //       if (_result.initialSigned === sig) {
  //         return this.client.hset(connId, 'verified', true).then(() => {
  //           return Promise.resolve(true)
  //         })
  //       }
  //       return false
  //     }
  //     return false
  //   })
  // }

  updateConnectionEntry(connId, socketId) {
    try {
      return this.client.hexists(connId, 'receiver').then(_result => {
        if (_result === 0) {
          return this.client.hset(connId, 'receiver', socketId).then(() => {
            return Promise.resolve(true)
          })
        }
        return false
      })
    } catch (e) {
      infoLogger.error('updateConnectionEntry', { e })
      return false
    }
  }

  updateTurnStatus(connId) {
    return this.client.hset(connId, 'requireTurn', true).then(_response => {
      infoLogger.info(_response)
      return this.client.hincrby(connId, 'tryTurnSignalCount', 1)
    })
  }

  removeConnectionEntry(connId) {
    return this.client
      .hdel(
        connId,
        'initiator',
        'receiver',
        'initialSigned',
        'requireTurn',
        'tryTurnSignalCount'
      )
      .then(_result => {
        return _result >= 3
      })
  }

  // Expose the Underlying Redis Client
  getClient() {
    return this.client
  }

  hset(identifier, requestedBlockNumber, clonedValue) {
    return this.client.hset(
      identifier,
      'blockNumber',
      requestedBlockNumber,
      'result',
      JSON.stringify(clonedValue)
    )
  }

  hsetExpires(identifier, requestedBlockNumber, clonedValue, time) {
    return this.client.hset(
      requestedBlockNumber,
      identifier,
      JSON.stringify(clonedValue),
      'EX',
      time
    )
  }

  hgetall(identifier) {
    return this.client.hgetall(identifier)
  }

  hdel(previousHex, key) {
    return this.client.hdel(previousHex, key)
  }
}
