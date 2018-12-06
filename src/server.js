'use strict'

// todo look into refactoring to accept plug-in testing data, and/or testing tools
import debug from 'debug'
import dotenv from 'dotenv'
import http from 'http'
import logger from 'logging'
import redisAdapter from 'socket.io-redis'
import socketIO from 'socket.io'
import twilio from 'twilio'

import validator from '@/validators'
import RedisClient from '@/redisClient'
import { redisConfig, serverConfig, socketConfig, signal, stages } from '@/config'

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
   * @param {Object} options.redis - Configuration pertaining to the Redis client
   * @param {Object} options.redis.host - Host address of the Redis client
   * @param {Object} options.redis.port - Port that the Redis host runs on
   */
  constructor (options = {}) {
    // Options will either be set in constructor or default to those defined in @/config //
    options.server = options.server || serverConfig
    options.redis = options.redis || redisConfig

    // Set host/port to those define in options or @/config and create HTTP server //
    this.port = options.server.port
    this.host = options.server.host
    this.server = http.createServer()

    // Create Map of clients //
    this.clients = options.clients || new Map()

    // Create Redis client with configuration defined in options or @/config //
    this.redis = new RedisClient(options.redis)

    this.io = socketIO(this.server, options.socket || socket)
    if (options.redis) this.io.adapter(redisAdapter({
      host: options.redis.host || redis.host,
      port: options.redis.port || redis.port
    }))
    this.server.listen({host: this.host, port: this.port}, () => {
      infoLogger.info(`Listening on ${this.server.address().address}:${this.port}`)
    })

    this.io.on(signal.connection, this.ioConnection.bind(this))
  }

  static create(options) {
    // if no options object is provided then the options set in the config are used
    return new SignalServer(options)
  }
}
