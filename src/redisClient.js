// const redis = require("redis");
const Redis = require('ioredis')
const {promisify} = require('util')

class RedisClient {
  constructor (options) {
    this.options = options || {}
    // this.client = redis.createClient();
    this.client = new Redis({
      port: 6379, // Redis port
      host: '127.0.0.1', // Redis host
      family: 4, // 4 (IPv4) or 6 (IPv6)
      db: this.options.db || 0
    })

    // this.client.unref();
    this.client.on('ready', () => {
      console.log('REDIS READY ')
    })
    this.client.on('error', err => {
      console.log('Error ' + err)
    })
    this.client.on('connect', () => {
      console.log('Client Connected')
    })
    this.client.on('end', () => {
      console.log('connection closed')
    })

    // if(this.options.monitor){
    //     this.client.monitor(function (err, res) {
    //         console.log("Entering monitoring mode.");
    //     });
    //     this.client.on("monitor", function (time, args, raw_reply) {
    //         console.log(time + ": " + args); // 1458910076.446514:['set', 'foo', 'bar']
    //     });
    // }
  }

  createConnectionEntry (details, socketId) {

    let connId = details.connId
    let message = details.message
    let initialSigned = details.signed
    let pub = details.pub
    let initiator = socketId
    let receiver = details.receiver || undefined
    let requireTurn = false
    let tryTurnSignalCount = 0
    // this.client
    this.client.hset(
      connId,
      'initiator',
      initiator,
      'receiver',
      receiver,
      'requireTurn',
      requireTurn,
      'tryTurnSignalCount',
      tryTurnSignalCount
    )
  }

  updateConnectionEntry (socketId) {

  }

  // Expose the Underlying Redis Client
  getClient () {
    return this.client
  }

  hset (identifier, requestedBlockNumber, clonedValue) {
    return this.client.hset(
      identifier,
      'blockNumber',
      requestedBlockNumber,
      'result',
      JSON.stringify(clonedValue)
    )
  }

  hsetExpires (identifier, requestedBlockNumber, clonedValue, time) {
    return this.client.hset(
      requestedBlockNumber,
      identifier,
      JSON.stringify(clonedValue),
      'EX',
      time
    )
  }

  hgetall (identifier) {
    return this.client.hgetall(identifier)
  }

  hdel (previousHex, key) {
    return this.client.hdel(previousHex, key)
  }
}

module.exports = RedisClient