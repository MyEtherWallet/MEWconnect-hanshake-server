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
import { redisConfig, serverConfig, socketConfig, signals, stages } from '@config'

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
  constructor (options = {}) {
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

  async init () {
    // Create HTTP server //
    this.server = await http.createServer()

    // Create Redis client with configuration defined in options or @/config //
    this.redis = await new RedisClient(this.options.redis)

    // Promisify server.listen for async/await and listen on configured options //
    let serverPromise = promisify(this.server.listen).bind(this.server)
    await serverPromise({ host: this.host, port: this.port })
    infoLogger.info(`Listening on ${this.server.address().address}:${this.port}`)

    // Create socket.io connection using socket.io-redis //
    this.io = await socketIO(this.server, this.options.socket)
    this.io.adapter(redisAdapter({
      host: this.options.redis.host,
      port: this.options.redis.port
    }))
    this.io.on(signals.connection, this.ioConnection.bind(this))

    // Ready //
    infoLogger.info('SignalServer Ready!')
  }

  async validate (message, next) {
    try {
      await validator(message)
      return next()
    } catch (e) {
      return next(new Error('invalid signal or parameters'))
    }
  }

  ioConnection (socket) {
    try {
      // Use class function validate() middleware //
      socket.use(this.validate.bind(this))

      // Get socket handshake query token //
      const token = socket.handshake.query
      const stage = token.stage || false
      const connId = token.connId || false

      // ERROR: invalid connection id //
      if (this.invalidHex(connId)) throw new Error('Connection attempted to pass an invalid connection ID')

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
      socket.on(signals.signature, data => {
        socket.emit(signals.receivedSignal, signals.signature)
        verbose(`${signals.signature} signal Recieved for ${data.connId} `)
        extraverbose('Recieved: ', signals.signature)
        this.receiverConfirm(socket, data)
      })

      // Handle signal "offerSignal" event //
      socket.on(signals.offerSignal, offerData => {
        socket.emit(signals.receivedSignal, signals.offerSignal)
        verbose(`${signals.offerSignal} signal Recieved for ${offerData.connId} `)
        this.io.to(offerData.connId).emit(signals.offer, {data: offerData.data})
      })

      // Handle signal "answerSignal" event //
      socket.on(signals.answerSignal, answerData => {
        socket.emit(signals.receivedSignal, signals.answerSignal)
        verbose(`${signals.answerSignal} signal Recieved for ${answerData.connId} `)
        this.io.to(answerData.connId).emit(signals.answer, {
          data: answerData.data,
          options: answerData.options
        })
      })

      // Handle signal "rtcConnected" event //
      socket.on(signals.rtcConnected, connId => {
        // Clean up client record
        verbose(`Removing connection entry for: ${connId}`)
        this.redis.removeConnectionEntry(connId)
        this.io.to(connId).emit(signals.rtcEstablished, {
          data: {
            msg: 'WebRTC Connection Established. Goodbye.'
          }
        })
        // socket.leave(connId)
        verbose('WebRTC CONNECTED', connId)
      })

      // Handle signal "disconnect" event //
      socket.on(signals.disconnect, reason => {
        verbose('disconnect reason: ', reason)
        socket.disconnect(true)
      })
    } catch (e) {
      errorLogger.error('ioConnection:createTurnConnection', {e})
    }
  }

  invalidHex (hex) {
    return !(/[0-9A-Fa-f].*/.test(hex));
  }

  ////////////////////////////// 
  createTurnConnection() {
    try {
      turnLog('CREATE TURN CONNECTION');
      const accountSid = process.env.TWILIO;
      const authToken = process.env.TWILIO_TOKEN;
      const ttl = process.env.TWILIO_TTL;
      const client = twilio(accountSid, authToken);
      return client.tokens
        .create({ttl: ttl});
    } catch (e) {
      errorLogger.error(e);
      return null;
    }
  }

  initiatorIncomming(socket, details) {
    try {
      initiatorLog(`INITIATOR CONNECTION with connection ID: ${details.connId}`);
      extraverbose('Initiator details: ', details);
      if (this.invalidHex(socket.id)) throw new Error('Connection attempted to pass an invalid socket ID');
      this.redis.createConnectionEntry(details, socket.id)
        .then(() => {
          socket.join(details.connId);
          socket.emit(signals.initiated, details)
        });
    } catch (e) {
      errorLogger.error('initiatorIncomming', {e});
    }
  }

  receiverIncomming(socket, details) {
    try {
      receiverLog(`RECEIVER CONNECTION for ${details.connId}`);
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');

      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          if (_result) {
            verbose(_result);
            this.redis.getConnectionEntry(details.connId)
              .then(_result => {
                socket.emit(signals.handshake, {toSign: _result.message});
              });
          } else {
            receiverLog(`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`);
            socket.emit(signals.invalidConnection);
          }
        });
    } catch (e) {
      errorLogger.error('receiverIncoming', {e});
    }
  }

  receiverConfirm(socket, details) {
    try {
      receiverLog('RECEIVER CONFIRM: ', details.connId);
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          receiverLog(`Located Matching Connection for ${details.connId}`);
          verbose(_result);
          if (_result) {
            this.redis.verifySig(details.connId, details.signed)
              .then(_result => {
                if (_result) {
                  socket.join(details.connId);
                  receiverLog(`PAIR CONNECTION VERIFICATION COMPLETED for ${details.connId}`);
                  this.redis.updateConnectionEntry(details.connId, socket.id)
                    .then(_result => {
                      if (_result) {
                        receiverLog(`Updated connection entry for ${details.connId}`);
                        socket.to(details.connId).emit(signals.confirmation, {
                          connId: details.connId,
                          version: details.version
                        });
                      } else {
                        receiverLog(`CONFIRMATION FAILED: BUSY for connection ID ${details.connId}`);
                        socket.to(details.connId).emit(signals.confirmationFailedBusy);
                      }
                    })
                    .catch(error => {
                      errorLogger.error('receiverConfirm:updateConnectionEntry', {error});
                    });
                } else {
                  receiverLog(`CONNECTION VERIFY FAILED for ${details.connId}`);
                  socket.emit(signals.confirmationFailed);
                }
              })
              .catch(error => {
                errorLogger.error('receiverConfirm:verifySig', {error});
              });
          } else {
            receiverLog(`INVALID CONNECTION DETAILS PROVIDED for ${details.connId}`);
            socket.emit(signals.invalidConnection);
          }
        })
        .catch(error => {
          errorLogger.error('receiverConfirm:locateMatchingConnection', {error});
        });
    } catch (e) {
      errorLogger.error('receiverConfirm', {e});
    }
  }

}
