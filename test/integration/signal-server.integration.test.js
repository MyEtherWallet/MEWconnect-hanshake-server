'use strict'

// Imports //
import _ from 'lodash'
import Peer from 'simple-peer'
import SocketIO from 'socket.io'
import SocketIOClient from 'socket.io-client'
import Redis from 'ioredis'
import wrtc from 'wrtc'

// Libs //
import CryptoUtils from '@utils/crypto-utils'
import { redisConfig, serverConfig, signals, stages, rtcSignals } from '@config'
import SignalServer from '@clients/signal-server'
import RedisClient from '@clients/redis-client'

// ===================== Test "Member Variables" ======================== //

// Instantiate SignalServer instance //
const signalServer = new SignalServer()

// Server/Socket Variables //
let serverAddress
const socketOptions = {
  'reconnection delay': 0,
  'reopen delay': 0,
  'force new connection': true,
  'connect timeout': 5000,
  transports: ['websocket', 'polling', 'flashsocket'],
  secure: true
}

// WebRTC Variables //
const stunServers = [ { urls: 'stun:global.stun.twilio.com:3478?transport=udp' } ]
const defaultWebRTCOptions = {
  trickle: false,
  iceTransportPolicy: 'relay',
  config: {
    iceServers: stunServers
  },
  wrtc: wrtc
}

// Key Variables //
let publicKey
let privateKey
let connId
let signed
const version = '0.0.1'

// Initiatior Object //
let initiator = {
  socket: {},
  version: {},
  peer: {},
  answer: {}
}

// Receiver Object //
let receiver = {
  socket: {},
  version: {},
  peer: {},
  offer: {}
}

// ===================== Test "Member Functions" ======================== //

/**
 * Connect to SignalServer and return the established socket connection
 * @param  {Object} options - Options to extend to merge with the "global" socketOptions
 * @return {Object} - Established socket connection with SignalServer
 */
const connect = async (options = {}, namespace = '') => {
  let mergedOptions = _.merge(options, socketOptions)
  let socketManager = SocketIOClient(`${serverAddress}/${namespace}`, mergedOptions)
  let socket = await socketManager.connect()
  return socket
}

/**
 * Disconnect from a particular socket connection
 * @param  {Object} socket - An established socket connection with SignalServer
 */
const disconnect = async (socket) => {
  if (socket.connected) await socket.disconnect()
}

// ============================ Test Start =============================== //

describe('Signal Server', () => {
  /**
   * Initialization tests involving the instantiation of SignalServer
   */
  describe('Initilization', () => {
    it('Should properly initialize', async () => {
      await signalServer.init()

      // HTTP Server //
      const serverAddress = signalServer.server.address()
      expect(typeof serverAddress).toBe('object')
      expect(serverAddress.address).toEqual(serverConfig.host)
      expect(serverAddress.port).toEqual(serverConfig.port)

      // Redis //
      expect(signalServer.redis instanceof RedisClient).toBe(true)
      const client = signalServer.redis.client
      expect(client instanceof Redis).toBe(true)
      expect(client.options.host).toEqual(redisConfig.host)
      expect(client.options.port).toEqual(redisConfig.port)

      // SocketIO //
      expect(signalServer.io instanceof SocketIO)
    })
  })

  describe('Pairing', () => {
    /**
     * Before all tests, get the SignalServer address and generate keys
     * used for communication.
     */
    beforeAll(async (done) => {
      // SignalServer Details //
      let address = signalServer.server.address()
      serverAddress = `http://${address.address}:${address.port}`

      // Keys / Connection Details //
      let keys = CryptoUtils.generateKeys()
      publicKey = keys.publicKey
      privateKey = keys.privateKey
      connId = CryptoUtils.generateConnId(publicKey)
      signed = CryptoUtils.signMessage(privateKey, privateKey)

      done()
    })

    /**
     * After each test, stop listening to signals.receivedSignal event.
     * Each discrete test will listen to this event if need be.
     */
    afterEach(async (done) => {
      if (initiator.socket.connected) await initiator.socket.off(signals.receivedSignal)
      if (receiver.socket.connected) await receiver.socket.off(signals.receivedSignal)
      done()
    })

    /**
     * After all tests are completed, close socket connections.
     */
    afterAll(async (done) => {
      await disconnect(initiator.socket)
      await disconnect(receiver.socket)
      done()
    })

    /**
     * Initial signaling tests involving the socketIO connection of SignalServer.
     * The SignalServer aims to establish a secure communication channel between two peers,
     * and connect them via webRTC.
     */

    describe('Initial Signaling', () => {
      describe('Connect [Server → Initiator]', () => {
        it('Should initiate socket connection', async (done) => {
          let message = CryptoUtils.generateRandomMessage()
          let options = {
            query: {
              stage: stages.initiator,
              signed: signed,
              message: message,
              connId: connId
            }
          }
          initiator.socket = await connect(options)
          initiator.socket.on(signals.initiated, async (data) => {
            done()
          })
        })
      })

      describe('Handshake [Server → Receiver]', () => {
        it('Should initiate socket connection with credentials created by initiator', async (done) => {
          let options = {
            query: {
              stage: stages.receiver,
              signed: signed,
              connId: connId
            }
          }
          receiver.socket = await connect(options)
          receiver.socket.on(signals.handshake, data => {
            expect(data).toHaveProperty('toSign')
            done()
          })
        })
      })

      describe('Signature [Receiver → Server]', () => {
        it('Should sign with identity credentials supplied to server for validation against credentials initially supplied to the server by the initiator', async (done) => {
          let versionObject = await CryptoUtils.encrypt(version, privateKey)
          receiver.socket.binary(false).emit(signals.signature, {
            signed: signed,
            connId: connId,
            version: versionObject
          })
          receiver.socket.on(signals.receivedSignal, signal => {
            expect(signal).toMatch(signals.signature)
            done()
          })
        })
      })

      describe('Confirmation [Server → Initiator] (', () => {
        it('Should receive confirmation of receiver identity made by the server and initialization of RTC my be attempted', async (done) => {
          initiator.socket.on(signals.confirmation, data => {
            initiator.version = data.version
            expect(data).toHaveProperty('connId')
            expect(data).toHaveProperty('version')
            let expectedVersionProperties = ['ciphertext', 'ephemPublicKey', 'iv', 'mac']
            expect(Object.keys(data.version)).toEqual(expect.arrayContaining(expectedVersionProperties))
            done()
          })
        })
      })
    })

    // ===================== Offer Creation Tests ======================== //

    describe('Offer Creation', () => {
      describe('OfferSignal [Initiator → Server]', () => {
        it('Should send an offer and server list to the SignalServer for retransmission to the receiver', async (done) => {
          // Add initiator property to default options //
          let webRTCOptions = {
            initiator: true,
            ...defaultWebRTCOptions
          }

          // Create initiator WebRTC peer //
          initiator.peer = new Peer(webRTCOptions)
          initiator.peer.on(rtcSignals.signal, async (data) => {
            expect(data).toHaveProperty('type')
            expect(data).toHaveProperty('sdp')

            // Send WebRTC offer as encrypted string //
            let encryptedSend = await CryptoUtils.encrypt(JSON.stringify(data), privateKey)

            // Emit offer signal for receiver //
            initiator.socket.binary(false).emit(signals.offerSignal, {
              data: encryptedSend,
              connId: connId,
              options: stunServers
            })

            // Listen for confirmation SignalServer received signal //
            initiator.socket.on(signals.receivedSignal, signal => {
              expect(signal).toMatch(signals.offerSignal)
              done()
            })
          })
        })
      })

      describe('Offer [Server → Receiver] ', () => {
        it('Should receive retransmission of the offer and server list from the initiator', async (done) => {
          receiver.socket.on(signals.offer, async (data) => {
            let decryptedMessage = await CryptoUtils.decrypt(data.data, privateKey)

            // Parse offer //
            receiver.offer = JSON.parse(decryptedMessage)
            let expectedVersionProperties = ['type', 'sdp']
            expect(Object.keys(receiver.offer)).toEqual(expect.arrayContaining(expectedVersionProperties))
            done()
          })
        })
      })
    })

    // ===================== Answer Creation Tests ======================== //

    describe('Answer Creation', () => {
      describe('AnswerSignal [Receiver → Server]', () => {
        it('Should transmit an answer to the received offer for retransmission to the initiator', async (done) => {
          // Default webRTC options -- not the initiator //
          let webRTCOptions = {
            ...defaultWebRTCOptions
          }

          // Create Receiver WebRTC peer //
          receiver.peer = new Peer(webRTCOptions)
          receiver.peer.signal(receiver.offer)
          receiver.peer.on(rtcSignals.signal, async (data) => {
            expect(data).toHaveProperty('type')
            expect(data).toHaveProperty('sdp')

            // Send WebRTC offer as encrypted string //
            let encryptedSend = await CryptoUtils.encrypt(JSON.stringify(data), privateKey)

            // Emit offer signal for receiver //
            receiver.socket.binary(false).emit(signals.answerSignal, {
              data: encryptedSend,
              connId: connId
            })

            // Listen for confirmation SignalServer received signal //
            receiver.socket.on(signals.receivedSignal, signal => {
              expect(signal).toMatch(signals.answerSignal)
              done()
            })
          })

          receiver.peer.on(rtcSignals.error, async (data) => {
            // FAIL //
          })
        })
      })

      describe('Answer [Server → Initiator]', () => {
        it('Should receive transmission of receiver answerSignal response to offer', async (done) => {
          initiator.socket.on(signals.answer, async (data) => {
            let decryptedMessage = await CryptoUtils.decrypt(data.data, privateKey)

            // Parse answer //
            initiator.answer = JSON.parse(decryptedMessage)
            let expectedVersionProperties = ['type', 'sdp']
            expect(Object.keys(initiator.answer)).toEqual(expect.arrayContaining(expectedVersionProperties))
            done()
          })
        })
      })

      describe('RTC Connection [Initiator & Receiver] ', () => {
        it('Should establish RTC connection between the initiator and receiver', async (done) => {
          // Ensure Initiator is connected. Must also send signal to connect to receiver //
          let initiatorPeerConnectPromise = new Promise((resolve, reject) => {
            initiator.peer.signal(initiator.answer)
            initiator.peer.on(rtcSignals.connect, data => {
              resolve()
            })
            initiator.peer.on(rtcSignals.error, err => {
              reject(err)
            })
          })

          // Ensure Receiver is connected //
          let receiverPeerConnectPromise = new Promise((resolve, reject) => {
            receiver.peer.on(rtcSignals.connect, data => {
              resolve()
            })
            receiver.peer.on(rtcSignals.error, err => {
              reject(err)
            })
          })

          // Await promises from both receiver and initiator //
          await Promise.all([
            receiverPeerConnectPromise,
            initiatorPeerConnectPromise
          ])

          // Success //
          done()
        })
      })

      describe('RtcConnected [Initiator → Server]', () => {
        it('Should inform SignalServer of successful RTC connection', async (done) => {
          initiator.socket.binary(false).emit(signals.rtcConnected, connId)
          initiator.socket.on(signals.receivedSignal, signal => {
            expect(signal).toMatch(signals.rtcConnected)
            done()
          })
        })
      })

      describe('RtcConnected [Receiver → Server]', () => {
        it('Should inform SignalServer of successful RTC connection', async (done) => {
          receiver.socket.binary(false).emit(signals.rtcConnected, connId)
          receiver.socket.on(signals.receivedSignal, signal => {
            expect(signal).toMatch(signals.rtcConnected)
            done()
          })
        })
      })
    })
  })
  // ===================== RTC Connection Tests ======================== //
})
