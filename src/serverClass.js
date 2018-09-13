// todo look into refactoring to accept plug-in testing data, and/or testing tools
// const debug = require('debug')('signal');
import dotenv from 'dotenv'
import debug from 'debug'
import createLogger from 'logging'
import twilio from 'twilio'
import http from 'http'
import socketIO from 'socket.io'
import redisAdapter from 'socket.io-redis'

import RedisClient from './redisClient'
import { redis, server, socket, signal, stages } from './config'
dotenv.config()

const errorLogger = createLogger('SignalServer:ERROR')

debug.log = console.log.bind(console);
const initiatorLog = debug('signal:initiator');
const receiverLog = debug('signal:receiver');
const turnLog = debug('signal:turn');
const verbose = debug('signal:verbose');
const extraverbose = debug('verbose');

export default class SignalServer {
  constructor (options) {
    options = options || {}
    options.server = options.server || {}
    options.redis = options.redis || {}
    this.logger = options.logger || console
    this.clients = options.clients || new Map()
    this.port = options.server.port || server.port
    this.host = options.server.host || server.host

    this.server = http.createServer()

    const redisOptions = options.redis.port ? options.redis : redis
    this.redis = new RedisClient(redisOptions)

    this.io = socketIO(this.server, options.socket || socket)
    if (options.redis) this.io.adapter(redisAdapter({ host: options.redis.host || redis.host, port: options.redis.port || redis.port }))
    this.server.listen({host: this.host, port: this.port}, () => {
      console.log(this.server.address()) // todo remove dev item
      console.log(`Listening on ${this.port}`)
    })

    if (options.listen) this.io.use(this.listenToConn.bind(this)) // debuging usage (non-functional)

    this.io.on(signal.connection, this.ioConnection.bind(this))
  }

  static create (options) {
    // if no options object is provided then the options set in the config are used
    return new SignalServer(options)
  }

  createTurnConnection () {
    try {
      turnLog('CREATE TURN CONNECTION')
      const accountSid = process.env.TWILIO
      const authToken = process.env.TWILLO_TOKEN
      const client = twilio(accountSid, authToken)
      return client.tokens
        .create()
    } catch (e) {
      errorLogger.error(e)
      return null
    }
  }

  invalidHex (hex) {
    return !(/[0-9A-Fa-f].*/.test(hex))
  }

  initiatorIncomming (socket, details) {
    try {
      initiatorLog('INITIATOR CONNECTION')
      verbose(details)
      if (this.invalidHex(socket.id)) throw new Error('Connection attempted to pass an invalid socket ID')
      this.redis.createConnectionEntry(details, socket.id)
        .then(() => {
          socket.join(details.connId)
        })
    } catch (e) {
      errorLogger.error('initiatorIncomming', {e})
    }
  }

  receiverIncomming (socket, details) {
    try {
      initiatorLog('RECEIVER CONNECTION')
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID')

      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          if (_result) {
            verbose(_result)
            // emit #1 handshake  (listener: receiver peer)
            this.redis.getConnectionEntry(details.connId)
              .then(_result => {
                socket.emit(signal.handshake, { toSign: _result.message })
              })
          } else {
            receiverLog(`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`)
            receiverLog('current client map: ', this.clients)
            socket.emit(signal.invalidConnection) // emit InvalidConnection
          }
        })
    } catch (e) {
      errorLogger.error('receiverIncoming', {e})
    }
  }

  // This may now be redundant
  receiverConfirm (socket, details) {
    try {
      receiverLog('RECEIVER CONFIRM')
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID')
      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          receiverLog('Located Matching Connection')
          verbose(_result)
          if (_result) {
            this.redis.verifySig(details.connId, details.signed)
              .then(_result => {
                if (_result) {
                  socket.join(details.connId)
                  receiverLog('PAIR CONNECTION VERIFIED')
                  this.redis.updateConnectionEntry(details.connId, socket.id)
                    .then(_result => {
                      if (_result) {
                        receiverLog('Updated connection entry')
                        // emit #2  confirmation (listener: initiator peer)
                        socket.to(details.connId).emit(signal.confirmation, {
                          connId: details.connId,
                          version: details.version
                        })
                      } else {
                        // emit confirmationFailedBusy
                        receiverLog('CONFIRMATION FAILED: BUSY')
                        socket.to(details.connId).emit(signal.confirmationFailedBusy)
                      }
                    })
                    .catch(error => {
                      errorLogger.error('receiverConfirm:updateConnectionEntry', {error})
                    })
                } else {
                  receiverLog('CONNECTION VERIFY FAILED')
                  socket.emit(signal.confirmationFailed) // emit confirmationFailed
                }
              })
              .catch(error => {
                errorLogger.error('receiverConfirm:verifySig', {error})
              })
          } else {
            receiverLog('NO CONNECTION DETAILS PROVIDED')
            socket.emit(signal.invalidConnection) // emit InvalidConnection
          }
        })
        .catch(error => {
          errorLogger.error('receiverConfirm:locateMatchingConnection', {error})
        })
    } catch (e) {
      errorLogger.error('receiverConfirm', {e})
    }
  }

  ioConnection (socket) {
    try {
      const token = socket.handshake.query
      const connector = token.stage || false
      if (this.invalidHex(token.connId)) throw new Error('Connection attempted to pass an invalid connection ID')
      switch (connector) {
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
          return
      }

      socket.on(signal.signature, (data) => {
        verbose('Recieved: ', signal.signature)
        this.receiverConfirm(socket, data)
      })

      socket.on(signal.offerSignal, (offerData) => {
        verbose('OFFER: ', offerData)
        // emit #3 offer (listener: receiver peer)
        this.io.to(offerData.connId).emit(signal.offer, { data: offerData.data })
      })

      socket.on(signal.answerSignal, (answerData) => {
        verbose('ANSWER: ', answerData)
        // emit #4 answer (listener: initiator peer)
        this.io.to(answerData.connId).emit(signal.answer, { data: answerData.data })
      })

      socket.on(signal.rtcConnected, (connId) => {
        // Clean up client record
        verbose(`Removing connection entry for: ${connId}`)
        this.redis.removeConnectionEntry(connId)
        socket.leave(connId)
        verbose('WebRTC CONNECTED')
      })

      socket.on(signal.disconnect, (reason) => {
        verbose('disconnect reason', reason)
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
                verbose(`Update TURN status for ${conData.connId}`)
                this.redis.updateTurnStatus(connData.connId)
                this.createTurnConnection()
                  .then((_results) => {
                    turnLog('Turn Credentials Retrieved')
                    // emit #5 turnToken (listener: both peer)
                    socket.to(connData.connId).emit(signal.turnToken, { data: _results.iceServers })
                    turnLog(`ice servers returned. token.iceServers: ${_results.iceServers}`)
                  })
                  .catch(error => {
                    errorLogger.error('ioConnection:createTurnConnection', {error})
                  })
              } catch (e) {
                errorLogger.error('', {e})
              }
            } else {
              errorLogger.error(' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT')
              turnLog(` connectiono ID. data.connId: ${connData.connId}`)
            }
          })
          .catch(_error =>{
            errorLogger.error('FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT \n', _error)
          })
      })
    } catch (e) {
      errorLogger.error('', {e})
    }
  }

  listenToConn (socket, next) {
    extraverbose('-------------------- exchange Listener --------------------')
    extraverbose(socket.handshake)
    extraverbose('------------------------------------------------------------')
    next()
  }
}
