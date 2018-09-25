import Redis from 'ioredis';
import dotenv from 'dotenv';
import createLogger from 'logging';

const logger = createLogger('Redis');

dotenv.config();

export default class RedisClient {
  constructor(options) {
    this.connectionErrorCounter = 0;
    this.options = options || {};
    this.timeout = this.options.timeout ? this.options.timeout : process.env.CONNECTION_TIMEOUT || 60;
    logger.info(`Redis Timeout: ${this.timeout} seconds`);
    this.client = new Redis({
      port: this.options.port || 6379, // Redis port
      host: this.options.host || '127.0.0.1', // Redis host
      family: this.options.family || 4, // 4 (IPv4) or 6 (IPv6)
      db: this.options.db || 0
    });

    this.client.on('ready', () => {
      logger.info('REDIS READY ');
    });
    this.client.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        // Terminate process with error if redis server becomes unavailable for too long
        if (this.connectionErrorCounter > 100) {
          logger.error('TERMINATING PROCESS: CONNECTION TO REDIS SERVER REFUSED MORE THAN 100 TIMES');
          process.exit(1);
        }
        this.connectionErrorCounter++;
      }
      logger.error(err);
    });
    this.client.on('connect', () => {
      logger.info('Client Connected');
    });
    this.client.on('end', () => {
      logger.info('connection closed');
    });
  }

  disconnect() {
    this.client.disconnect();
  }

  createConnectionEntry(details, socketId) {
    const connId = details.connId;
    const message = details.message;
    const initialSigned = details.signed;
    const initiator = socketId;
    const requireTurn = false;
    const tryTurnSignalCount = 0;
    const hsetArgs = [
      'initiator',
      initiator,
      'message',
      message,
      'initialSigned',
      initialSigned,
      'requireTurn',
      requireTurn,
      'tryTurnSignalCount',
      tryTurnSignalCount];

    return this.client.hset(connId, hsetArgs)
      .then((_result) => {
        this.client.expire(connId, this.timeout)
          .then(() => {
            return _result;
          })
          .catch(error => {
            logger.error('createConnectionEntry', {error});
          });
      });
  }

  verifySig(connId, sig) {
    return this.client.hgetall(connId)
      .then((_result) => {
        if (typeof _result === 'object') {
          if (_result.initialSigned === sig) {
            return this.client.hset(connId, 'verified', true)
              .then(() => { return Promise.resolve(true); });
          }
          return false;
        }
        return false;
      });
  }

  locateMatchingConnection(connId) {
    return this.client.exists(connId)
      .then((_result) => {
        return _result === 1;
      });
  }

  updateConnectionEntry(connId, socketId) {
    try {
      return this.client.hexists(connId, 'receiver')
        .then((_result) => {
          if (_result === 0) {
            return this.client.hset(
              connId,
              'receiver',
              socketId
            )
              .then(() => { return Promise.resolve(true); });
          }
          return false;
        });
    } catch (e) {
      logger.error('updateConnectionEntry', {e});
      return false;
    }
  }

  updateTurnStatus(connId) {
    return this.client.hset(
      connId,
      'requireTurn',
      true
    )
      .then((_response) => {
        logger.info(_response);
        return this.client.hincrby(
          connId,
          'tryTurnSignalCount',
          1
        );
      });
  }

  removeConnectionEntry(connId) {
    return this.client.hdel(
      connId,
      'initiator',
      'receiver',
      'initialSigned',
      'requireTurn',
      'tryTurnSignalCount'
    )
      .then((_result) => {
        return _result >= 3;
      });
  }

  getConnectionEntry(connId) {
    return this.client.hgetall(connId);
  }

  // Expose the Underlying Redis Client
  getClient() {
    return this.client;
  }

  hset(identifier, requestedBlockNumber, clonedValue) {
    return this.client.hset(
      identifier,
      'blockNumber',
      requestedBlockNumber,
      'result',
      JSON.stringify(clonedValue)
    );
  }

  hsetExpires(identifier, requestedBlockNumber, clonedValue, time) {
    return this.client.hset(
      requestedBlockNumber,
      identifier,
      JSON.stringify(clonedValue),
      'EX',
      time
    );
  }

  hgetall(identifier) {
    return this.client.hgetall(identifier);
  }

  hdel(previousHex, key) {
    return this.client.hdel(previousHex, key);
  }
}
