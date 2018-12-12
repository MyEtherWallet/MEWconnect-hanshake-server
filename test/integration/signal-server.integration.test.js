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
  describe('init', () => {
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
  describe('io', () => {
    // ===================== Test "Member Variables" ======================== //
    let socket
    let socketManager
    let serverAddress
    let socketOptions = {
      'reconnection delay': 0,
      'reopen delay': 0,
      'force new connection': true,
      transports: ['websocket', 'polling', 'flashsocket'],
      secure: true
    }
    let publicKey
    let privateKey
    let connId
    let signed

    // ===================== Test "Member Functions" ======================== //

    const connect = async (options = {}) => {
      let mergedOptions = _.merge(options, socketOptions)
      socketManager = SocketIOClient(serverAddress, mergedOptions)
      socket = await socketManager.connect()
    }

    const disconnect = async (options) => {
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

    // Close socket connection after each test //
    afterEach(async (done) => {
      await disconnect()
      done()
    })

    // ===================== Connection Tests ======================== //

    it('Should be able to connect', async (done) => {
      await connect()
      socket.on('connect', () => {
        expect(socket.connected).toBe(true)
        done()
      })
    })

    it('<INITIATOR> Should be able to initiate', async (done) => {
      let message = CryptoUtils.generateRandomMessage()
      let options = {
        query: {
          stage: stages.initiator,
          signed: signed,
          message: message,
          connId: connId
        }
      }
      await connect(options)
      socket.on(signals.initiated, data => {
        done()
      })
    })

    it('<RECEIVER> Should be able to initiate', async (done) => {
      let options = {
        query: {
          stage: stages.receiver,
          signed: signed,
          connId: connId
        }
      }
      await connect(options)
      socket.on(signals.handshake, data => {
        expect(data).toHaveProperty('toSign')
        done()
      })
    })
  })
})
