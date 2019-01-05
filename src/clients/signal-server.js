'use strict'

// Import //
import debug from 'debug'
import http from 'http'
import logger from 'logging'
import { promisify } from 'util'
import redisAdapter from 'socket.io-redis'
import socketIO from 'socket.io'
import twilio from 'twilio'

// Lib //
import RedisClient from '@clients/redis-client'
import {
  redisConfig,
  serverConfig,
  socketConfig,
  signals,
  stages
} from '@config'
import { validateSignal, validConnId, validHex } from '@helpers/validation'

// SignalServer Loggers //
const errorLogger = logger('SignalServer:ERROR')
const infoLogger = logger('SignalServer:INFO')

// Signal Loggers //
debug.log = console.log.bind(console)
const initiatorLog = debug('signal:initiator')
const receiverLog = debug('signal:receiver')
const turnLog = debug('signal:turn')
const verbose = debug('signal:verbose')
// const extraverbose = debug('verbose')

/*
|--------------------------------------------------------------------------
|
| SignalServer
|
|--------------------------------------------------------------------------
|
| The SignalServer attempts to pair two signaling peers together via a secure Socket.io connection.
| These peers will then establish a webRTC connection to each other, allowing
| secure communication using the credentials created during the pairing process.
|
| The SignalServer performs the "pairing" process defined in the following documentation outline:
| https://docs.google.com/document/d/19acrYB3iLT4j9JDg0xGcccLXFenqfSlNiKVpXOdLL6Y
|
*/

export default class SignalServer {
  /**
   * Represents the "Signal Server" for handling MEWConnect Pairing Requests
   *
   * @constructor
   * @param {Object} options - Configuration options for the Signal Server
   *                         - These are typically obtained through config files in @/config
   * @param {Map} options.clients - Map object of connected clients
   * @param {Object} options.server - Configuration pertaining to the HTTP server
   * @param {String} options.server.host - Host address of the HTTP server
   * @param {String} options.server.port - Port that the HTTP server will run on
   * @param {Object} options.socket - Configuration pertaining to the socket.io server
   * @param {Object} options.redis - Configuration pertaining to the Redis client
   * @param {String} options.redis.host - Host address of the Redis client
   * @param {String} options.redis.port - Port that the Redis host runs on
   */
  constructor(options = {}) {
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

  /**
   * Initialize the SignalServer instance.
   *
   * 1. Initialize HTTP Server
   * 2. Initialize Redis Client
   * 3. Initialize SocketIO server
   * 4. Connect Redis Adapter
   * 5. Bind SocketIO on-connection middleware
   */
  async init() {
    // Create HTTP server //
    this.server = await http.createServer()

    // Create Redis client with configuration defined in options or @/config //
    this.redis = new RedisClient()
    await this.redis.init()

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
    this.io.on(signals.connection, this.ioConnection.bind(this))

    // Ready //
    infoLogger.info('SignalServer Ready!')
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
  async validateSignal(message, next) {
    try {
      await validateSignal(message)
      return next()
    } catch (e) {
      return next(new Error('invalid signal or parameters'))
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
  ioConnection(socket) {
    try {
      // Use class function validate() middleware //
      socket.use(this.validateSignal.bind(this))

      // Socket handshake query //
      const details = socket.handshake.query
      const stage = details.stage || false
      const connId = details.connId || false

      // Ensure valid connId //
      if (!validConnId(connId)) {
        throw new Error('Connection attempted to pass an invalid connId')
      }

      // Handle connection based on stage provided by query details //
      switch (stage) {
        case stages.initiator:
          initiatorLog('Initiator stage identifier recieved')
          this.handleInitiator(socket, details)
          break
        case stages.receiver:
          receiverLog('Receiver stage identifier recieved')
          this.handleReceiver(socket, details)
          break
        default:
          errorLogger.error('Invalid Stage Supplied')
          return false
      }

      // Bind socket events //
      socket.on(signals.signature, this.onSignature.bind(this, socket))
      socket.on(signals.offerSignal, this.onOfferSignal.bind(this, socket))
      socket.on(signals.answerSignal, this.onAnswerSignal.bind(this, socket))
      socket.on(signals.rtcConnected, this.onRtcConnected.bind(this, socket))
      socket.on(signals.disconnect, this.onDisconnect.bind(this, socket))
    } catch (e) {
      errorLogger.error('ioConnection', { e })
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
  onSignature(socket, data) {
    verbose(`${signals.signature} signal Recieved for ${data.connId} `)
    socket.emit(signals.receivedSignal, signals.signature)
    this.confirmReceiver(socket, data)
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
  onOfferSignal(socket, data) {
    verbose(`${signals.offerSignal} signal Recieved for ${data.connId} `)
    socket.emit(signals.receivedSignal, signals.offerSignal)
    this.io.to(data.connId).emit(signals.offer, { data: data.data })
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
  onAnswerSignal(socket, data) {
    verbose(`${signals.answerSignal} signal Recieved for ${data.connId} `)
    socket.emit(signals.receivedSignal, signals.answerSignal)
    this.io.to(data.connId).emit(signals.answer, {
      data: data.data,
      options: data.options
    })
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
  onRtcConnected(socket, connId) {
    verbose(`Removing connection entry for: ${connId}`)
    socket.emit(signals.receivedSignal, signals.rtcConnected)
    this.redis.removeConnectionEntry(connId)
    verbose('WebRTC connected', connId)
  }

  /**
   * Log client disconnect
   *
   * @param {Object} socket - Client's socket connection object
   * @param {String} data - Reason for disconnect
   */
  onDisconnect(socket, data) {
    verbose('Disconnect reason: ', data)
    socket.disconnect(true)
  }

  /*
  ===================================================================================
    Member Functions
  ===================================================================================
  */

  /**
   * Initialize a socket.io channel/redis entry with details provided by the initiator.
   *
   * @param {Object} socket - Client's socket connection object
   * @param {Object} details - Socket handshake query details provided by the initiator
   * @param {String} details.signed - Private key signed with the private key created
   *                                  for the connection
   * @param {String} details.connId - Last 32 characters of the public key portion of the key-pair
   *                                  created for the particular paired connection
   * @return {Event} signals.initiated - Event confirming that channel creation has been successful.
   */
  async handleInitiator(socket, details) {
    try {
      initiatorLog(`INITIATOR CONNECTION with connection ID: ${details.connId}`)

      // Ensure valid socket id and @signed parameter is included //
      if (!validHex(socket.id)) {
        throw new Error('Connection attempted to pass an invalid socket ID')
      }
      if (!details.signed) {
        throw new Error('Connection attempt missing a valid signed parameter')
      }

      // Create redis entry for socket connection and emit "initiated" event when complete //
      await this.redis.createConnectionEntry(details, socket.id)
      socket.join(details.connId)
      socket.emit(signals.initiated, details)
    } catch (e) {
      errorLogger.error('handleInitiator', { e })
    }
  }

  /**
   * Locate matching initiator socket.io channel/redis entry with details provided by the receiver.
   * This does not connect the receiver to the channel created by the initiator. The receiver
   * must successfully verify the signature emitted by this function in order to connect.
   *
   * @param {Object} socket - Client's socket connection object
   * @param {Object} details - Socket handshake query details provided by the receiver
   * @param {String} details.connId - Last 32 characters of the public key portion of the key-pair
   *                                  created for the particular paired connection
   * @return {Event} signals.handshake - Event/data payload to be handled by the receiver.
   */
  async handleReceiver(socket, details) {
    try {
      receiverLog(`RECEIVER CONNECTION for ${details.connId}`)

      // Ensure valid socket id and @signed parameter is included //
      if (!validHex(socket.id)) {
        throw new Error('Connection attempted to pass an invalid socket ID')
      }
      if (!details.signed) {
        throw new Error('Connection attempt missing a valid signed parameter')
      }

      // Ensure a matching @connId channel exists //
      let hasMatchingConnection = await this.redis.locateMatchingConnection(
        details.connId
      )
      if (!hasMatchingConnection) {
        receiverLog(`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`)
        return socket.emit(signals.invalidConnection)
      }

      // Get matching connection pair for a @connId and emit handshake signal
      let connectionEntry = await this.redis.getConnectionEntry(details.connId)
      socket.emit(signals.handshake, { toSign: connectionEntry.message })
    } catch (e) {
      errorLogger.error('receiverIncoming', { e })
    }
  }

  /**
   * Confirm that the signed "signature" provided by a receiver attempting to connect to
   * a given @connId matches the signature that the initiator originally provided. If so,
   * connect the receiver to the @connId channel for communication with the initiator, and update
   * the redis client entry.
   *
   * @param {Object} socket - Client's socket connection object
   * @param {Object} details - Message payloaded sent by the receiver
   * @param {String} details.signed - Private key signed with the private key created
   *                                  for the connection
   * @param {String} details.connId - Last 32 characters of the public key portion of the key-pair
   *                                  created for the particular paired connection
   * @param {Object} details.version - Version-string encrypted object using eccrypto
   * @return {Event} signals.confirmation - Confirmation of successful connection
   */
  async confirmReceiver(socket, details) {
    try {
      receiverLog('RECEIVER CONFIRM: ', details.connId)

      // Ensure there is a matching redis connection entry //
      let hasMatchingConnection = await this.redis.locateMatchingConnection(
        details.connId
      )
      if (!hasMatchingConnection) {
        receiverLog(`Invalid connection details for ${details.connId}`)
        return socket.emit(signals.invalidConnection)
      }

      // Ensure the connection has the proper signature details //
      let isVerified = await this.redis.verifySig(
        details.connId,
        details.signed
      )
      if (!isVerified) {
        receiverLog(`Connection verification failed for ${details.connId}`)
        return socket.emit(signals.confirmationFailed)
      }

      // Connect receiver to @connId channel //
      socket.join(details.connId)

      // Confirm proper Redis entry update //
      let didUpdate = await this.redis.updateConnectionEntry(
        details.connId,
        socket.id
      )
      if (!didUpdate) {
        receiverLog(`Confirmation failed: busy for ${details.connId}`)
        return socket.to(details.connId).emit(signals.confirmationFailedBusy)
      }

      // Success. Emit confirmation to @connId channel //
      receiverLog(`Updated connection entry for ${details.connId}`)
      this.io.to(details.connId).emit(signals.confirmation, {
        connId: details.connId,
        version: details.version
      })
      receiverLog(`Pair verification completed for ${details.connId}`)
    } catch (e) {
      errorLogger.error('confirmReceiver', { e })
    }
  }

  // TODO //
  createTurnConnection() {
    try {
      turnLog('CREATE TURN CONNECTION')
      const accountSid = process.env.TWILIO
      const authToken = process.env.TWILIO_TOKEN
      const ttl = process.env.TWILIO_TTL
      const client = twilio(accountSid, authToken)
      return client.tokens.create({ ttl: ttl })
    } catch (e) {
      errorLogger.error(e)
      return null
    }
  }
}
