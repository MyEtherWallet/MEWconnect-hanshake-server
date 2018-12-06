'use strict'

// Import //
// todo look into refactoring to accept plug-in testing data, and/or testing tools
import createLogger from 'logging'
import debug from 'debug'
import dotenv from 'dotenv'
import http from 'http'
import logger from 'logging'
import { promisify } from 'util'
import redisAdapter from 'socket.io-redis'
import socketIO from 'socket.io'
import twilio from 'twilio'

// Lib //
import validator from '@/validators'
import RedisClient from '@/redisClient'
import { redisConfig, serverConfig, socketConfig, signal, stages } from '@/config'

// Loggers //
const errorLogger = createLogger('SignalServer:ERROR')
const infoLogger = createLogger('SignalServer:INFO')

export default class SignalServer {
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
  constructor (options = {}) {
    return (async () => {
      // Options will either be set in constructor or default to those defined in @/config //
      options.server = options.server || serverConfig
      options.socket = options.socket || socketConfig
      options.redis = options.redis || redisConfig

      // Create Map of clients //
      this.clients = options.clients || new Map()

      // Set host/port to those define in options or @/config and create HTTP server //
      this.port = options.server.port
      this.host = options.server.host
      this.server = await http.createServer()

      // Create Redis client with configuration defined in options or @/config //
      this.redis = await new RedisClient(options.redis)

      // Promisify server.listen for async/await and listen on configured options //
      let serverPromise = promisify(this.server.listen).bind(this.server)
      await serverPromise({ host: this.host, port: this.port })
      infoLogger.info(`Listening on ${this.server.address().address}:${this.port}`)

      // Create socket.io connection using socket.io-redis //
      this.io = await socketIO(this.server, options.socket)
      this.io.adapter(redisAdapter({
        host: options.redis.host,
        port: options.redis.port
      }))

      // this.io.on(signal.connection, this.ioConnection.bind(this))

      // Return SignalServer after successful asynchronous instantiation //
      return this
    })()
  }
}
