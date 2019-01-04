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

/*
|--------------------------------------------------------------------------
|
| SignalServer Integration Tests
|
|--------------------------------------------------------------------------
|
| The goal of these integration tests are to ensure the functionality of the SignalServer.
| The SignalServer attempts to pair two "signaling" peers together via a secure Socket.io connection.
| These peers will then establish a webRTC connection to each other, allowing
| secure communication using the credentials created during the pairing process.
|
| The tests attempt to mirror the process defined in the following documentation outline:
| https://docs.google.com/document/d/19acrYB3iLT4j9JDg0xGcccLXFenqfSlNiKVpXOdLL6Y
|
| There are (2) primary processes that must be tested, the majority of which occurs in the
| "Pairing" section:
|
| 1. Initialization
  2. Pairing
|     a. Initial Signaling
|     b. Offer Creation
|     c. Answer Creation
|     d. RTC Connection
|
*/

/*
===================================================================================
  Test "Member Variables"
===================================================================================
*/

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
const stunServers = [{ urls: 'stun:global.stun.twilio.com:3478?transport=udp' }]
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
let versionObject
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

/*
===================================================================================
  Test "Member Functions"
===================================================================================
*/

/**
 * Connect to SignalServer and return the established socket connection
 * @param  {Object} options - Options to extend to merge with the "global" socketOptions
 * @return {Object} - Established socket connection with SignalServer
 */
const connect = async (options = {}, namespace = '') => {
  try {
    let mergedOptions = _.merge(options, socketOptions)
    let socketManager = SocketIOClient(
      `${serverAddress}/${namespace}`,
      mergedOptions
    )
    let socket = await socketManager.connect()
    return socket
  } catch (e) {
    return e
  }
}

/**
 * Disconnect from a particular socket connection
 * @param  {Object} socket - An established socket connection with SignalServer
 */
const disconnect = async socket => {
  if (socket.connected) await socket.disconnect()
}

/**
 * Set a timeout to perform callback after process.env.CONNECTION_TIMEOUT
 * @param  {Function} done - Callback function to perform (usually passing a test)
 */
const pass = async done => {
  setTimeout(done, process.env.CONNECTION_TIMEOUT)
}

/*
===================================================================================
  Test Start
===================================================================================
*/
describe('Signal Server', () => {
  /*
  ===================================================================================
    1. Initialization
  ===================================================================================
  */
  describe('Initilization', () => {
    describe('<SUCCESS>', () => {
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
  })

  /*
  ===================================================================================
    2. Pairing
  ===================================================================================
  */
  describe('Pairing', () => {
    /**
     * Before all tests, get the SignalServer address and generate keys
     * used for communication.
     */
    beforeAll(async done => {
      // SignalServer Details //
      let address = signalServer.server.address()
      serverAddress = `http://${address.address}:${address.port}`

      // Keys / Connection Details //
      let keys = CryptoUtils.generateKeys()
      publicKey = keys.publicKey
      privateKey = keys.privateKey
      connId = CryptoUtils.generateConnId(publicKey)
      signed = CryptoUtils.signMessage(privateKey, privateKey)
      versionObject = await CryptoUtils.encrypt(version, privateKey)

      done()
    })

    /**
     * After each test, stop listening to each signal event
     * Each discrete test will listen to this event if need be.
     */
    afterEach(async done => {
      Object.keys(signals).forEach(async key => {
        let signal = signals[key]
        if (initiator.socket.connected) await initiator.socket.off(signal)
        if (receiver.socket.connected) await receiver.socket.off(signal)
      })
      done()
    })

    /**
     * After all tests are completed, close socket connections.
     */
    afterAll(async done => {
      await disconnect(initiator.socket)
      await disconnect(receiver.socket)
      done()
    })

    /*
    ===================================================================================
      2a. Pairing -> Initial Signaling
    ===================================================================================
    */
    describe('Initial Signaling', () => {
      /*
      ===================================================================================
        2a-1. Pairing -> Initial Signaling -> Connect [Server → Initiator]
      ===================================================================================
      */
      describe('Connect [Server → Initiator]', () => {
        let message
        let connectionOptions

        beforeAll(() => {
          message = CryptoUtils.generateRandomMessage()
          connectionOptions = {
            query: {
              stage: stages.initiator,
              signed: signed,
              message: message, // NOTE: Doesn't seem to be needed...
              connId: connId
            }
          }
        })

        /*
        ===================================================================================
          2a-1. Pairing -> Initial Signaling -> Connect [Server → Initiator] -> FAIL
        ===================================================================================
        */
        describe('<FAIL>', () => {
          it('Should not connect with missing @stage property', async done => {
            let options = _.cloneDeep(connectionOptions)
            delete options.query.stage
            initiator.socket = await connect(options)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.initiated, async data => {
              throw new Error('Connected with missing @stage property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @stage property', async done => {
            let options = _.cloneDeep(connectionOptions)
            options.query.stage = 'invalid'
            initiator.socket = await connect(options)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.initiated, async data => {
              throw new Error('Connected with invalid @stage property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @connId property', async done => {
            let options = _.cloneDeep(connectionOptions)
            delete options.query.connId
            initiator.socket = await connect(options)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.initiated, async data => {
              throw new Error('Connected with invalid @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @connId property', async done => {
            let options = _.cloneDeep(connectionOptions)
            options.query.connId = 'invalid'
            initiator.socket = await connect(options)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.initiated, async data => {
              throw new Error('Connected with invalid @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @signed property', async done => {
            let options = _.cloneDeep(connectionOptions)
            delete options.query.signed
            initiator.socket = await connect(options)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.initiated, async data => {
              throw new Error('Connected with missing @signed property')
            })

            // Pass after timeout //
            pass(done)
          })
        })

        /*
        ===================================================================================
          2a-1. Pairing -> Initial Signaling -> Connect [Server → Initiator] -> SUCCESS
        ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should initiate socket connection', async done => {
            let options = _.cloneDeep(connectionOptions)

            initiator.socket = await connect(options)
            initiator.socket.on(signals.initiated, async data => {
              done()
            })
          })
        })
      })

      /*
      ===================================================================================
        2a-2. Pairing -> Initial Signaling -> Handshake [Server → Receiver]
      ===================================================================================
      */
      describe('Handshake [Server → Receiver]', () => {
        let connectionOptions

        beforeAll(() => {
          connectionOptions = {
            query: {
              stage: stages.receiver,
              signed: signed,
              connId: connId
            }
          }
        })

        /*
        ===================================================================================
          2a-2. Pairing -> Initial Signaling -> Handshake [Server → Receiver] -> FAIL
        ===================================================================================
        */
        describe('<FAIL>', () => {
          it('Should not connect with missing @stage property', async done => {
            let options = _.cloneDeep(connectionOptions)
            delete options.query.stage
            receiver.socket = await connect(options)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.handshake, async data => {
              throw new Error('Connected with missing @stage property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @stage property', async done => {
            let options = _.cloneDeep(connectionOptions)
            options.query.stage = 'invalid'
            receiver.socket = await connect(options)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.handshake, async data => {
              throw new Error('Connected with invalid @stage property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @connId property', async done => {
            let options = _.cloneDeep(connectionOptions)
            delete options.query.connId
            receiver.socket = await connect(options)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.initiated, async data => {
              throw new Error('Connected with missing @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @connId property', async done => {
            let options = _.cloneDeep(connectionOptions)
            options.query.connId = 'invalid'
            receiver.socket = await connect(options)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.handshake, async data => {
              throw new Error('Connected with invalid @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @signed property', async done => {
            let options = _.cloneDeep(connectionOptions)
            delete options.query.signed
            receiver.socket = await connect(options)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.handshake, async data => {
              throw new Error('Connected with missing @signed property')
            })

            // Pass after timeout //
            pass(done)
          })
        })

        /*
        ===================================================================================
          2a-2. Pairing -> Initial Signaling -> Handshake [Server → Receiver] -> SUCCESS
        ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should initiate socket connection with credentials supplied by initiator', async done => {
            let options = _.cloneDeep(connectionOptions)

            receiver.socket = await connect(options)
            receiver.socket.on(signals.handshake, data => {
              expect(data).toHaveProperty('toSign')
              done()
            })
          })
        })
      })

      /*
      ===================================================================================
        2a-3. Pairing -> Initial Signaling -> Signature [Receiver → Server]
      ===================================================================================
      */
      describe('Signature [Receiver → Server]', () => {
        let signaturePayload

        beforeAll(() => {
          signaturePayload = {
            signed: signed,
            connId: connId,
            version: versionObject
          }
        })

        /*
        ===================================================================================
          2a-3. Pairing -> Initial Signaling -> Signature [Receiver → Server] -> FAIL
        ===================================================================================
        */
        describe('<FAIL>', () => {
          it('Should not connect with missing @signed property', async done => {
            let payload = _.cloneDeep(signaturePayload)
            delete payload.signed
            receiver.socket.binary(false).emit(signals.signature, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with missing @signed property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @connId property', async done => {
            let payload = _.cloneDeep(signaturePayload)
            delete payload.connId
            receiver.socket.binary(false).emit(signals.signature, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with missing @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @connId property', async done => {
            let payload = _.cloneDeep(signaturePayload)
            payload.connId = 'invalid'
            receiver.socket.binary(false).emit(signals.signature, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with invalid @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @version property', async done => {
            let payload = _.cloneDeep(signaturePayload)
            delete payload.version
            receiver.socket.binary(false).emit(signals.signature, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with missing @version property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @version property', async done => {
            let payload = _.cloneDeep(signaturePayload)
            payload.version = 'invalid'
            receiver.socket.binary(false).emit(signals.signature, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with invalid @version property')
            })

            // Pass after timeout //
            pass(done)
          })
        })

        /*
        ===================================================================================
          2a-3. Pairing -> Initial Signaling -> Signature [Receiver → Server] -> SUCCESS
        ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should sign with identity credentials supplied to server for validation against credentials initially supplied to the server by the initiator', async done => {
            let payload = _.cloneDeep(signaturePayload)
            receiver.socket.binary(false).emit(signals.signature, payload)

            receiver.socket.on(signals.receivedSignal, signal => {
              expect(signal).toMatch(signals.signature)
              done()
            })
          })
        })
      })

      /*
      ===================================================================================
        2a-4. Pairing -> Initial Signaling -> Confirmation [Server → Initiator]
      ===================================================================================
      */
      describe('Confirmation [Server → Initiator]', () => {
        /*
        ===================================================================================
          2a-4. Pairing -> Initial Signaling -> Confirmation [Server → Initiator] -> SUCCESS
        ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should receive confirmation of receiver identity made by the server and initialization of RTC my be attempted', async done => {
            initiator.socket.on(signals.confirmation, data => {
              initiator.version = data.version
              expect(data).toHaveProperty('connId')
              expect(data).toHaveProperty('version')
              let expectedVersionProperties = [
                'ciphertext',
                'ephemPublicKey',
                'iv',
                'mac'
              ]
              expect(Object.keys(data.version)).toEqual(
                expect.arrayContaining(expectedVersionProperties)
              )
              done()
            })
          })
        })
      })
    })

    /*
      ===================================================================================
        2b. Pairing -> Offer Creation
      ===================================================================================
    */
    describe('Offer Creation', () => {
      /*
        ===================================================================================
          2b-1. Pairing -> Offer Creation -> OfferSignal [Initiator → Server]
        ===================================================================================
      */
      describe('OfferSignal [Initiator → Server]', () => {
        let encryptedData
        let offerPayload

        beforeAll(async (done) => {
          encryptedData = await CryptoUtils.encrypt(version, privateKey)
          offerPayload = {
            data: encryptedData,
            connId: connId,
            options: stunServers
          }
          done()
        })

        /*
          ===================================================================================
            2b-1. Pairing -> Offer Creation -> OfferSignal [Initiator → Server] -> FAIL
          ===================================================================================
        */
        describe('<FAIL>', () => {
          it('Should not connect with missing @data property', async done => {
            let payload = _.cloneDeep(offerPayload)
            delete payload.data
            initiator.socket.binary(false).emit(signals.offerSignal, payload)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with missing @data property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @data property', async done => {
            let payload = _.cloneDeep(offerPayload)
            payload.data = 'invalid'
            initiator.socket.binary(false).emit(signals.offerSignal, payload)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with invalid @data property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @connId property', async done => {
            let payload = _.cloneDeep(offerPayload)
            delete payload.connId
            initiator.socket.binary(false).emit(signals.offerSignal, payload)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with missing @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @connId property', async done => {
            let payload = _.cloneDeep(offerPayload)
            payload.connId = 'invalid'
            initiator.socket.binary(false).emit(signals.offerSignal, payload)

            // Fail on signal that would indicate success //
            initiator.socket.on(signals.receivedSignal, async data => {
              throw new Error('Connected with invalid @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
        })

        /*
          ===================================================================================
            2b-1. Pairing -> Offer Creation -> OfferSignal [Initiator → Server] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should send an offer and server list to the SignalServer for retransmission to the receiver', async done => {
            // Add initiator property to default options //
            let webRTCOptions = {
              initiator: true,
              ...defaultWebRTCOptions
            }

            // Create initiator WebRTC peer //
            initiator.peer = new Peer(webRTCOptions)
            initiator.peer.on(rtcSignals.signal, async data => {
              expect(data).toHaveProperty('type')
              expect(data).toHaveProperty('sdp')

              // Send WebRTC offer as encrypted string //
              let encryptedSend = await CryptoUtils.encrypt(
                JSON.stringify(data),
                privateKey
              )

              // Emit offer signal for receiver //
              let payload = _.cloneDeep(offerPayload)
              payload.data = encryptedSend
              initiator.socket.binary(false).emit(signals.offerSignal, payload)

              // Listen for confirmation SignalServer received signal //
              initiator.socket.on(signals.receivedSignal, signal => {
                expect(signal).toMatch(signals.offerSignal)
                done()
              })
            })
          })
        })
      })

      /*
        ===================================================================================
          2b-2. Pairing -> Offer Creation -> Offer [Server → Receiver]
        ===================================================================================
      */
      describe('Offer [Server → Receiver] ', () => {
        /*
          ===================================================================================
            2b-2. Pairing -> Offer Creation -> Offer [Server → Receiver] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should receive retransmission of the offer and server list from the initiator', async done => {
            receiver.socket.on(signals.offer, async data => {
              let decryptedMessage = await CryptoUtils.decrypt(
                data.data,
                privateKey
              )

              // Parse offer //
              receiver.offer = JSON.parse(decryptedMessage)
              let expectedVersionProperties = ['type', 'sdp']
              expect(Object.keys(receiver.offer)).toEqual(
                expect.arrayContaining(expectedVersionProperties)
              )
              done()
            })
          })
        })
      })
    })

    /*
      ===================================================================================
        2c. Pairing -> Answer Creation
      ===================================================================================
    */
    describe('Answer Creation', () => {
      const webRTCOptions = {
        ...defaultWebRTCOptions
      }

      /*
        ===================================================================================
          2c-1. Pairing -> Answer Creation -> AnswerSignal [Receiver → Server]
        ===================================================================================
      */
      describe('AnswerSignal [Receiver → Server]', () => {
        let encryptedData
        let answerPayload

        beforeAll(async (done) => {
          encryptedData = await CryptoUtils.encrypt(version, privateKey)
          answerPayload = {
            data: encryptedData,
            connId: connId
          }
          done()
        })

        /*
          ===================================================================================
            2c-1. Pairing -> Answer Creation -> AnswerSignal [Receiver → Server] -> FAIL
          ===================================================================================
        */
        describe('<FAIL>', () => {
          it('Should not connect with missing @data property', async done => {
            let payload = _.cloneDeep(answerPayload)
            delete payload.data
            receiver.socket.binary(false).emit(signals.answerSignal, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, signal => {
              throw new Error('Connected with missing @data property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @data property', async done => {
            let payload = _.cloneDeep(answerPayload)
            payload.data = 'invalid'
            receiver.socket.binary(false).emit(signals.answerSignal, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, signal => {
              throw new Error('Connected with invalid @data property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with missing @connId property', async done => {
            let payload = _.cloneDeep(answerPayload)
            delete payload.connId
            receiver.socket.binary(false).emit(signals.answerSignal, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, signal => {
              throw new Error('Connected with missing @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
          it('Should not connect with invalid @connId property', async done => {
            let payload = _.cloneDeep(answerPayload)
            payload.connId = 'invalid'
            receiver.socket.binary(false).emit(signals.answerSignal, payload)

            // Fail on signal that would indicate success //
            receiver.socket.on(signals.receivedSignal, signal => {
              throw new Error('Connected with invalid @connId property')
            })

            // Pass after timeout //
            pass(done)
          })
        })

        /*
          ===================================================================================
            2c-1. Pairing -> Answer Creation -> AnswerSignal [Receiver → Server] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should transmit an answer to the received offer for retransmission to the initiator', async done => {
            // Create Receiver WebRTC peer //
            receiver.peer = new Peer(webRTCOptions)
            receiver.peer.signal(receiver.offer)
            receiver.peer.on(rtcSignals.signal, async data => {
              expect(data).toHaveProperty('type')
              expect(data).toHaveProperty('sdp')

              // Send WebRTC offer as encrypted string //
              let encryptedSend = await CryptoUtils.encrypt(
                JSON.stringify(data),
                privateKey
              )

              // Emit answer signal for initiator //
              let payload = _.cloneDeep(answerPayload)
              payload.data = encryptedSend
              receiver.socket.binary(false).emit(signals.answerSignal, payload)

              // Listen for confirmation SignalServer received signal //
              receiver.socket.on(signals.receivedSignal, signal => {
                expect(signal).toMatch(signals.answerSignal)
                done()
              })
            })

            receiver.peer.on(rtcSignals.error, async data => {
              // FAIL //
            })
          })
        })
      })

      /*
        ===================================================================================
          2c-2. Pairing -> Answer Creation -> Answer [Server → Initiator]
        ===================================================================================
      */
      describe('Answer [Server → Initiator]', () => {
        /*
          ===================================================================================
            2c-2. Pairing -> Answer Creation -> Answer [Server → Initiator] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should receive transmission of receiver answerSignal response to offer', async done => {
            initiator.socket.on(signals.answer, async data => {
              let decryptedMessage = await CryptoUtils.decrypt(
                data.data,
                privateKey
              )

              initiator.answer = JSON.parse(decryptedMessage)
              let expectedVersionProperties = ['type', 'sdp']
              expect(Object.keys(initiator.answer)).toEqual(
                expect.arrayContaining(expectedVersionProperties)
              )
              done()
            })
          })
        })
      })
    })

    /*
      ===================================================================================
      2d. Pairing -> RTC Connection
      ===================================================================================
    */
    describe('RTC Connection', () => {
      /*
        ===================================================================================
          2d-1. Pairing -> RTC Connection -> RTC Connection [Initiator & Receiver]
        ===================================================================================
      */
      describe('RTC Connection [Initiator & Receiver] ', () => {
        /*
          ===================================================================================
            2d-1. Pairing -> RTC Connection -> RTC Connection [Initiator & Receiver] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should establish RTC connection between the initiator and receiver', async done => {
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
      })

      /*
        ===================================================================================
          2d-2. Pairing -> RTC Connection -> RtcConnected [Initiator → Server]
        ===================================================================================
      */
      describe('RtcConnected [Initiator → Server]', () => {
        /*
          ===================================================================================
            2d-2. Pairing -> RTC Connection -> RtcConnected [Initiator → Server] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should inform SignalServer of successful RTC connection', async done => {
            initiator.socket.binary(false).emit(signals.rtcConnected, connId)
            initiator.socket.on(signals.receivedSignal, signal => {
              expect(signal).toMatch(signals.rtcConnected)
              done()
            })
          })
        })
      })

      /*
        ===================================================================================
          2d-3. Pairing -> RTC Connection -> RtcConnected [Receiver → Server]
        ===================================================================================
      */
      describe('RtcConnected [Receiver → Server]', () => {
        /*
          ===================================================================================
            2d-3. Pairing -> RTC Connection -> RtcConnected [Receiver → Server] -> SUCCESS
          ===================================================================================
        */
        describe('<SUCCESS>', () => {
          it('Should inform SignalServer of successful RTC connection', async done => {
            receiver.socket.binary(false).emit(signals.rtcConnected, connId)
            receiver.socket.on(signals.receivedSignal, signal => {
              expect(signal).toMatch(signals.rtcConnected)
              done()
            })
          })
        })
      })
    })
  })
})
