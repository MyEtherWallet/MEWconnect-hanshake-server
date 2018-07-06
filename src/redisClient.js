import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

export default class RedisClient {
  constructor (options) {
    this.options = options || {}
    // this.client = redis.createClient();
    this.timeout = this.options.timeout ? this.options.timeout : process.env.CONNECTION_TIMEOUT || 60
    console.log(`Redis Timeout: ${this.timeout} seconds`) // todo remove dev item
    this.client = new Redis({
      port: this.options.port || 6379, // Redis port
      host: this.options.host || '127.0.0.1', // Redis host
      family: this.options.family || 4, // 4 (IPv4) or 6 (IPv6)
      db: this.options.db || 0
    })

    // this.client.unref();
    this.client.on('ready', () => {
      console.log('REDIS READY ')
      // console.log(this.client.getBuiltinCommands()) // todo remove dev item
    })
    this.client.on('error', (err) => {
      console.log(err)
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

  disconnect () {
    this.client.disconnect()
  }

  createConnectionEntry (details, socketId) {
    const connId = details.connId
    const message = details.message
    const initialSigned = details.signed
    const pub = details.pub
    const initiator = socketId
    const receiver = details.receiver || undefined
    const requireTurn = false
    const tryTurnSignalCount = 0
    // this.client
    // console.log(this.client.hsetnx.toString()); // todo remove dev item
    return this.client.hset(
      connId,
      'initiator',
      initiator,
      // 'receiver',
      // receiver,
      'message',
      message,
      'initialSigned',
      initialSigned,
      'requireTurn',
      requireTurn,
      'tryTurnSignalCount',
      tryTurnSignalCount
    )
      .then((_result) => {
        this.client.expire(connId, this.timeout)
          .then((_expireSet) => {
            console.log('expire set: ', _expireSet) // todo remove dev item
            return _result
          })
      })
  }

  verifySig (connId, sig) {
    return this.client.hgetall(connId)
      .then((_result) => {
        console.log('_result', _result) // todo remove dev item
        if (typeof _result === 'object') {
          if (_result.initialSigned === sig) {
            return this.client.hset(connId, 'verified', true)
              .then(_result => true)
          }
          return false
        }
        return false
      })
    // return this.initialSigned === receiver;
  }

  locateMatchingConnection (connId) {
    return this.client.exists(connId)
      .then((_result) => {
        if (_result === 1) {
          return true
        }
        return false
      })
  }

  updateConnectionEntry (connId, socketId) {
    try {
      return this.client.hexists(connId, 'receiver')
        .then((_result) => {
          console.log('updateConnectionEntry exists check', _result) // todo remove dev item
          if (_result === 0) {
            return this.client.hset(
              connId,
              'receiver',
              socketId
            )
              .then(_response => true)
          }
          return false
        })
    } catch (e) {
      console.error(e) // todo remove dev item
      return false
    }
  }

  updateTurnStatus (connId) {
    return this.client.hset(
      connId,
      'requireTurn',
      true
    )
      .then((_response) => {
        console.log(_response) // todo remove dev item
        return this.client.hincrby(
          connId,
          'tryTurnSignalCount',
          1
        )
      })
    // .then(_response => {
    //   return true
    // })
  }

  removeConnectionEntry (connId) {
    return this.client.hdel(
      connId,
      'initiator',
      'receiver',
      'initialSigned',
      'requireTurn',
      'tryTurnSignalCount'
    )
      .then((_result) => {
        if (_result >= 3) {
          return true
        }
        return false
      })
  }

  getConnectionEntry (connId) {
    return this.client.hgetall(connId)
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
