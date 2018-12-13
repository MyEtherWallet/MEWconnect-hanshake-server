'use strict'

// Imports //
import _ from 'lodash'
import SocketIO from 'socket.io'
import SocketIOClient from 'socket.io-client'
import Redis from 'ioredis'

// Libs //
import CryptoUtils from '@utils/crypto-utils'
import { redisConfig, serverConfig, signals, stages } from '@config'
import SignalServer from '@clients/signal-server'
import RedisClient from '@clients/redis-client'

describe('Signal Server', () => {
  // Instantiate SignalServer instance //
  const signalServer = new SignalServer()

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

  /**
   * IO tests involving the socketIO connection of SignalServer.
   * Good reference: https://medium.com/@tozwierz/testing-socket-io-with-jest-on-backend-node-js-f71f7ec7010f
   */
  describe('IO', () => {
    // ===================== Test "Member Variables" ======================== //

    // Server/Socket Variables //
    let serverAddress
    let socketOptions = {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true,
      'connect timeout': 5000,
      transports: ['websocket', 'polling', 'flashsocket'],
      secure: true
    }

    // Key Variables //
    let publicKey
    let privateKey
    let connId
    let signed
    let version = '0.0.1'

    // Initiatior //
    let initiator = {
      socketManager: {},
      socket: {}
    }

    // Receiver //
    let receiver = {
      socketManager: {},
      socket: {}
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
      console.log(`${serverAddress}/${namespace}`)
      let socket = await socketManager.connect()
      return socket
      // return {
      //   socketManager,
      //   socket
      // }
    }

    /**
     * Disconnect from a particular socket connection
     * @param  {Object} socket - An established socket connection with SignalServer
     */
    const disconnect = async (socket) => {
      if (socket.connected) await socket.disconnect()
    }

    // ===================== Test Initilization Processes ======================== //

    // Initialize variables used in all tests //
    beforeAll(async (done) => {
      // SigalServer Details //
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

    // Close socket connection after tests are completed //
    afterAll(async (done) => {
      await disconnect(initiator.socket)
      await disconnect(receiver.socket)
      done()
    })

    // ===================== Connection Tests ======================== //

    describe('Initiator', () => {
      it('Should be able to initiate', async (done) => {
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

    describe('Receiver', () => {
      it('Should be able to initiate', async (done) => {
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

      it('Should be able to join connId namespace', async (done) => {
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

      it('Should be able to sign', async (done) => {
        let versionObject = await CryptoUtils.encrypt(version, privateKey)
        receiver.socket.binary(false).emit(signals.signature, {
          signed: signed,
          connId: connId,
          version: versionObject
        })

        // Initiator socket will already have joined connId channel, listen for response //
        initiator.socket.on(signals.confirmation, data => {
          expect(data).toHaveProperty('connId')
          expect(data).toHaveProperty('version')
          let expectedVersionProperties = ['ciphertext', 'ephemPublicKey', 'iv', 'mac']
          expect(Object.keys(data.version)).toEqual(expect.arrayContaining(expectedVersionProperties))
          done()
        })
      })
    })
  })
})
