'use strict'

// Imports //
import SocketIO from 'socket.io'
import SocketIOClient from 'socket.io-client'
import Redis from 'ioredis'

// Libs //
import { redisConfig, serverConfig, signal, stages } from '@config'
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
    // Reused variables //
    let socket
    let serverAddress

    // Initialize variables used in all tests //
    beforeAll(async (done) => {
      serverAddress = signalServer.server.address()
      socket = await SocketIOClient.connect(`http://${serverAddress.address}:${serverAddress.port}`)
      done()
    })

    // Connect to socketIO before each test //
    beforeEach(async (done) => {
      socket = await SocketIOClient.connect(`http://${serverAddress.address}:${serverAddress.port}`, {
        'reconnection delay': 0,
        'reopen delay': 0,
        'force new connection': true,
        transports: ['websocket']
      })
      socket.on('connect', () => {
        done()
      })
    })

    // Close socket connection after each test //
    afterEach(async (done) => {
      if (socket.connected) await socket.disconnect()
      done()
    })

    it('Should be able to connect', () => {
      expect(socket.connected).toBe(true)
    })
  })
})
