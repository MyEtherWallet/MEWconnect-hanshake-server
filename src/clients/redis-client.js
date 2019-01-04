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

    // Confirm required parameters are assigned //
    if (!connId || !message || !initialSigned || !initiator) {
      return false
    }

    // Write to Redis and set expiry time //
    try {
      let result = await this.client.hset(connId, hsetArgs)
      await this.client.expire(connId, this.options.timeout)
      return (result >= 5)
    } catch (e) {
      infoLogger.error('createConnectionEntry', { e })
      return false
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
  async locateMatchingConnection (connId) {
    if (!connId) return false
    let result = await this.client.exists(connId)
    return result === 1
  }

  /**
   * Get and return a particular Redis entry with key @connId
   *
   * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
   *                           created for the particular paired connection
   * @return {Object} - The connection entry object created with createConnectionEntry()
   *                    (and possibly modified with updateConnectionEntry())
   */
  async getConnectionEntry (connId) {
    if (!connId) return {}
    let result = await this.client.hgetall(connId)
    return result
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
  async updateConnectionEntry (connId, socketId) {
    if (!socketId) return false

    // Can't update an entry that does not exist! //
    let doesConnectionExist = await this.locateMatchingConnection(connId)
    if (!doesConnectionExist) return false

    // Update //
    try {
      let receiverExists = await this.client.hexists(connId, 'receiver')
      if (!receiverExists) {
        await this.client.hset(connId, 'receiver', socketId)
        return true
      }
      return false
    } catch (e) {
      infoLogger.error('updateConnectionEntry', { e })
      return false
    }
  }

  /**
   * Remove a particular connection entry from Redis.
   *
   * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
   *                           created for the particular paired connection
   * @return {Boolean} - True/false if successfully removed or not
   */
  async removeConnectionEntry (connId) {
    let result = await this.client
      .hdel(
        connId,
        'initiator',
        'receiver',
        'initialSigned',
        'requireTurn',
        'tryTurnSignalCount'
      )
    return (result >= 3)
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
  async verifySig (connId, sig) {
    try {
      let connectionEntry = await this.getConnectionEntry(connId)
      let isVerified = (connectionEntry.initialSigned === sig)
      await this.client.hset(connId, 'verified', isVerified)
      return isVerified
    } catch (e) {
      infoLogger.error('verifySig', { e })
      return false
    }
  }

  disconnect () {
    this.client.disconnect()
  }

  updateTurnStatus(connId) {
    return this.client.hset(connId, 'requireTurn', true).then(_response => {
      infoLogger.info(_response)
      return this.client.hincrby(connId, 'tryTurnSignalCount', 1)
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
