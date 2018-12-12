'use strict'

// Imports //
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
    // IO "member" variables //
    let socket
    let serverAddress
    let publicKey
    let privateKey
    let connId
    let signed
    let socketManager

    /**
     * Test initialization processes
     */

    // Initialize variables used in all tests //
    beforeAll(async (done) => {
      // SigalServer details //
      let address = signalServer.server.address()
      serverAddress = `http://${address.address}:${address.port}`

      // Connection Info //
      let keys = CryptoUtils.generateKeys()
      publicKey = keys.publicKey
      privateKey = keys.privateKey
      connId = CryptoUtils.generateConnId(publicKey)
      signed = CryptoUtils.signMessage(privateKey, privateKey)
      done()
    })

    // Connect to socketIO before each test //
    beforeEach(async (done) => {
      let message = CryptoUtils.generateRandomMessage()
      let options = {
        query: {
          stage: 'initiator',
          signed: signed,
          message: message,
          connId: connId
        },
        'reconnection delay': 0,
        'reopen delay': 0,
        'force new connection': true,
        transports: ['websocket', 'polling', 'flashsocket'],
        secure: true
      }
      socketManager = SocketIOClient(serverAddress, options)
      done()
    })

    // Close socket connection after each test //
    afterEach(async (done) => {
      if (socket.connected) await socket.disconnect()
      done()
    })

    /**
     * Tests
     */

    it('Should be able to connect', async (done) => {
      socket = await socketManager.connect()
      socket.on('connect', () => {
        expect(socket.connected).toBe(true)
        done()
      })
    })

    it('Should be able to initiate', async (done) => {
      socket = await socketManager.connect()
      socket.on(signals.initiated, data => {
        done()
      })
    })
  })
})
