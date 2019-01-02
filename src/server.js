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
import validator from '@helpers/validators'
import RedisClient from '@clients/redis-client'
import {
  redisConfig,
  serverConfig,
  socketConfig,
  signal,
  stages
} from '@config'

// SignalServer Loggers //
const errorLogger = createLogger('SignalServer:ERROR')
const infoLogger = createLogger('SignalServer:INFO')

// Signal Loggers //
debug.log = console.log.bind(console)
const initiatorLog = debug('signal:initiator')
const receiverLog = debug('signal:receiver')
const turnLog = debug('signal:turn')
const verbose = debug('signal:verbose')
const extraverbose = debug('verbose')

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
  constructor(options = {}) {
    // Instantiate member variable options //
    this.options = options

    // Options will either be set in constructor or default to those defined in @/config //
    this.options.server = this.options.server || serverConfig
    this.options.socket = this.options.socket || socketConfig
    this.options.redis = this.options.redis || redisConfig

    // Instantiate synchronous member variables //
    this.clients = this.options.clients || new Map()
    this.host = this.options.server.host
    this.port = this.options.server.port

    // Declare asynchronous member variable functions //
    this.server = {}
    this.redis = {}
    this.io = {}
  }

  async init() {
    // Create HTTP server //
    this.server = await http.createServer()

    // Create Redis client with configuration defined in options or @/config //
    this.redis = await new RedisClient(this.options.redis)

    // Promisify server.listen for async/await and listen on configured options //
    let serverPromise = promisify(this.server.listen).bind(this.server)
    await serverPromise({ host: this.host, port: this.port })
    infoLogger.info(
      `Listening on ${this.server.address().address}:${this.port}`
    )

    // Create socket.io connection using socket.io-redis //
    this.io = await socketIO(this.server, this.options.socket)
    this.io.adapter(
      redisAdapter({
        host: this.options.redis.host,
        port: this.options.redis.port
      })
    )
    this.io.on(signal.connection, this.ioConnection.bind(this))

    // Ready //
    infoLogger.info('SignalServer Ready!')
  }

  async validate(message, next) {
    try {
      await validator(message)
      return next()
    } catch (e) {
      return next(new Error('invalid signal or parameters'))
    }
  }

  ioConnection(socket) {
    try {
      // Use class function validate() middleware //
      socket.use(this.validate.bind(this))

      // Get socket handshake query token //
      const token = socket.handshake.query
      const stage = token.stage || false
      const connId = token.connId || false

      // ERROR: invalid connection id //
      if (this.isInvalidHex(connId))
        throw new Error('Connection attempted to pass an invalid connection ID')

      // Handle connection based on stage provided by token //
      switch (stage) {
        case stages.initiator:
          initiatorLog('Initiator stage identifier recieved')
          this.initiatorIncomming(socket, token)
          break
        case stages.receiver:
          receiverLog('Receiver stage identifier recieved')
          this.receiverIncomming(socket, token)
          break
        default:
          errorLogger.error('Invalid Stage Supplied')
          return false
      }

      // Handle signal "signature" event //
      socket.on(signal.signature, data => {
        verbose(`${signal.signature} signal Recieved for ${data.connId} `)
        extraverbose('Recieved: ', signal.signature)
        this.receiverConfirm(socket, data)
      })

      // Handle signal "offerSignal" event //
      socket.on(signal.offerSignal, offerData => {
        verbose(
          `${signal.offerSignal} signal Recieved for ${offerData.connId} `
        )
        this.io
          .to(offerData.connId)
          .emit(signal.offer, { data: offerData.data })
      })

      // Handle signal "answerSignal" event //
      socket.on(signal.answerSignal, answerData => {
        verbose(
          `${signal.answerSignal} signal Recieved for ${answerData.connId} `
        )
        this.io.to(answerData.connId).emit(signal.answer, {
          data: answerData.data,
          options: answerData.options
        })
      })

      // Handle signal "rtcConnected" event //
      socket.on(signal.rtcConnected, connId => {
        // Clean up client record
        verbose(`Removing connection entry for: ${connId}`)
        this.redis.removeConnectionEntry(connId)
        socket.leave(connId)
        verbose('WebRTC CONNECTED', connId)
      })

      // Handle signal "disconnect" event //
      socket.on(signal.disconnect, reason => {
        verbose('disconnect reason: ', reason)
        socket.disconnect(true)
      })
    } catch (e) {
      errorLogger.error('ioConnection:createTurnConnection', { e })
    }
  }

  isInvalidHex(hex) {
    return !/[0-9A-Fa-f].*/.test(hex)
  }
}
