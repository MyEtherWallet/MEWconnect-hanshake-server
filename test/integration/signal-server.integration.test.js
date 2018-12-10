'use strict'

// Imports //
import SocketIO from 'socket.io'
import Redis from 'ioredis'

// Libs //
import { redisConfig, serverConfig, socketConfig, signal, stages } from '@config'
import SignalServer from '@clients/signal-server'
import RedisClient from '@clients/redis-client'

describe('Signal Server', () => {
  // Intialization //
  describe('Init', () => {
    it('Should properly initialize', async () => {
      // Create SignalServer instance //
      const signalServer = new SignalServer()
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
