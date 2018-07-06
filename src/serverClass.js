// todo look into refactoring to accept plug-in testing data, and/or testing tools
import dotenv from 'dotenv'
import createLogger from 'logging'
import twilio from 'twilio'
import http from 'http'
import socketIO from 'socket.io'
import redisAdapter from 'socket.io-redis'

import RedisClient from './redisClient'
import { redis, server, socket, signal, stages } from '../config'
dotenv.config()

const logger = createLogger('SignalServer')

export default class SignalServer {
  constructor (options) {
    options = options || {}
    this.logger = options.logger || logger
    this.clients = options.clients || new Map()
    this.port = server.port || 8080

    this.server = http.createServer()

    this.redis = new RedisClient(redis)

    this.io = socketIO(this.server, socket)
    if (options.redis) this.io.adapter(redisAdapter({ host: redis.host, port: redis.port }))
    this.server.listen(this.port, () => {
      this.logger.info(this.server.address()) // todo remove dev item
      this.logger.info(`Listening on ${this.port}`)
    })

    if (options.listen) this.io.use(this.listenToConn.bind(this)) // debuging usage (non-functional)

    this.io.on(signal.connection, this.ioConnection.bind(this))
  }

  static create (options) {
    return new SignalServer(options)
  }

  createTurnConnection () {
    try {
      this.logger.debug('CREATE TURN CONNECTION')
      const accountSid = process.env.TWILIO
      const authToken = process.env.TWILLO_TOKEN
      const client = twilio(accountSid, authToken)
      return client.tokens
        .create()
    } catch (e) {
      console.error(e)
      return null
    }
  }

  invalidHex (hex) {
    return !(/[0-9A-Fa-f].*/.test(hex))
  }

  initiatorIncomming (socket, details) {
    try {
      this.logger.debug('INITIATOR CONNECTION')
      if (this.invalidHex(socket.id)) throw new Error('Connection attempted to pass an invalid socket ID')
      this.redis.createConnectionEntry(details, socket.id)
        .then(() => {
          socket.join(details.connId)
        })
    } catch (e) {
      this.logger.error('', {e})
    }
  }

  receiverIncomming (socket, details) {
    try {
      this.logger.debug('RECEIVER CONNECTION')
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID')

      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          if (_result) {
            // emit #1 handshake  (listener: receiver peer)
            this.redis.getConnectionEntry(details.connId)
              .then(_result => {
                socket.emit(signal.handshake, { toSign: _result.message })
              })
          } else {
            this.logger.debug(`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`)
            this.logger.debug('current client map: ', this.clients)
            socket.emit(signal.invalidConnection) // emit InvalidConnection
          }
        })
    } catch (e) {
      this.logger.error('', {e})
    }
  }

  // This may now be redundant
  receiverConfirm (socket, details) {
    try {
      this.logger.debug('RECEIVER CONFIRM')
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID')
      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          if (_result) {
            this.redis.verifySig(details.connId, details.signed)
              .then(_result => {
                if (_result) {
                  socket.join(details.connId)
                  this.logger.debug('PAIR CONNECTION VERIFIED')
                  this.redis.updateConnectionEntry(details.connId, socket.id)
                    .then(_result => {
                      if (_result) {
                        // emit #2  confirmation (listener: initiator peer)
                        socket.to(details.connId).emit(signal.confirmation, {
                          connId: details.connId,
                          version: details.version
                        })
                      } else {
                        // emit confirmationFailedBusy
                        this.logger.debug('CONFIRMATION FAILED: BUSY')
                        socket.to(details.connId).emit(signal.confirmationFailedBusy)
                      }
                    })
                } else {
                  this.logger.debug('CONNECTION VERIFY FAILED')
                  socket.emit(signal.confirmationFailed) // emit confirmationFailed
                }
              })
          } else {
            this.logger.debug('NO CONNECTION DETAILS PROVIDED')
            socket.emit(signal.invalidConnection) // emit InvalidConnection
          }
        })
    } catch (e) {
      this.logger.error('', {e})
    }
  }

  ioConnection (socket) {
    try {
      const token = socket.handshake.query
      const connector = token.stage || false
      if (this.invalidHex(token.connId)) throw new Error('Connection attempted to pass an invalid connection ID')
      switch (connector) {
        case stages.initiator:
          this.initiatorIncomming(socket, token)
          break
        case stages.receiver:
          this.receiverIncomming(socket, token)
          break
        default:
          this.logger.error('Invalid Stage Supplied')
          return
      }

      socket.on(signal.signature, (data) => {
        this.receiverConfirm(socket, data)
      })

      socket.on(signal.offerSignal, (offerData) => {
        this.logger.debug('OFFER: ', offerData)
        // emit #3 offer (listener: receiver peer)
        this.io.to(offerData.connId).emit(signal.offer, { data: offerData.data })
      })

      socket.on(signal.answerSignal, (answerData) => {
        this.logger.debug('ANSWER: ', answerData)
        // emit #4 answer (listener: initiator peer)
        this.io.to(answerData.connId).emit(signal.answer, { data: answerData.data })
      })

      socket.on(signal.rtcConnected, (connId) => {
        // Clean up client record
        this.redis.removeConnectionEntry(connId)
        socket.leave(connId)
        this.logger.debug('WebRTC CONNECTED')
      })

      socket.on(signal.disconnect, (reason) => {
        this.logger.debug('disconnect reason', reason)
        socket.disconnect(true)
      })

      socket.on(signal.tryTurn, (connData) => {
        // emit #4 answer (listener: initiator peer)
        socket.to(connData.connId).emit(signal.attemptingTurn, { data: null })

        this.redis.locateMatchingConnection(connData.connId)
          .then(_result => {
            if (_result) {
              // Catch error in getting turn credentials
              try {
                this.redis.updateTurnStatus(connData.connId)
                this.createTurnConnection()
                  .then((_results) => {
                    // emit #5 turnToken (listener: both peer)
                    socket.to(connData.connId).emit(signal.turnToken, { data: _results.iceServers })
                    this.logger.debug(`ice servers returned. token.iceServers: ${_results.iceServers}`)
                  })
              } catch (e) {
                this.logger.error('', {e})
              }
            } else {
              this.logger.debug(' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT')
              this.logger.debug(` connectiono ID. data.connId: ${connData.connId}`)
            }
          })
      })
    } catch (e) {
      this.logger.error('', {e})
    }
  }

  listenToConn (socket, next) {
    this.logger.debug('-------------------- exchange Listener --------------------')
    this.logger.debug(socket.handshake)
    this.logger.debug('------------------------------------------------------------')
    next()
  }
}
