require('dotenv').config({
  path: '../.env'
})
const server = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 8080
}

const redis = {
  host: process.env.DATA_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

const socket = {
  serveClient: false
  // secure: true
}

export {
  server,
  redis,
  socket
}

// const server = serverSig.create({
//   port: 3200, redis: redisOptions, server: serverOptions, socket: socketOptions
// })
