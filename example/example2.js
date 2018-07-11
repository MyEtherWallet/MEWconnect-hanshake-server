'use strict'

import {SignalServer} from '../src'

let options = {
  server: {
    host: 'localhost',
    port: '8081'
  },
  redis: {
    host: process.env.DATA_REDIS_HOST || 'localhost',
    port: 6379,
    timeout: 10
  },
  socket: {
    serveClient: false,
    secure: true
  }
}

const server = SignalServer.create(options)
