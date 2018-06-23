// todo look into refactoring to accept plug-in testing data, and/or testing tools
require('dotenv').config();
const { signal, stages, loggerLevels } = require('./signals');

const {
  errorLvl, warnLvl, infoLvl, debugLvl, sillyLvl,
} = loggerLevels;
const twilio = require('twilio');
const ServerConnection = require('./serverConnection');
const RedisClient = require("./redisClient")
const https = require('https');
const http = require('http');
const socketIO = require('socket.io');
const redisAdapter = require('socket.io-redis');

const port = process.env.PORT || 3001;

class SignalServer {
  constructor(options) {
    this.loggerLevels = loggerLevels;
    this.logger = options.logger ||  {log: console.log}; // { log() {} };
    this.clients = options.clients || new Map();
    this.port = options.port || port;
    if (!options.server) throw new Error('No config provided for server');
    if (!options.socket) throw new Error('No config provided for socket.io');

    if (options.server.http) {
      console.log('using http'); // todo remove dev item
      this.server = http.createServer();
    } else {
      this.server = https.createServer(options.server);
    }

    if(options.redis){
      this.redis = new RedisClient(options.redis);
    } else {
      this.redis = new RedisClient();
    }

    this.io = socketIO(this.server, options.socket);
    if(options.redis) this.io.adapter(redisAdapter({ host: options.redis.host || 'localhost', port: options.redis.port || 6379 }));
    this.server.listen(this.port, () => {
      console.log(this.server.address()); // todo remove dev item
      console.log(`Listening on ${this.port}`);
    });

    this.io.use(this.listenToConn.bind(this)); // debuging usage (non-functional)
    this.io.use((socket, next) => {
      // this.logger.log(sillyLvl, socket);
      next();
    });

    this.io.on(signal.connection, this.ioConnection.bind(this));
  }

  static create(options) {
    return new SignalServer(options);
  }

  createTurnConnection() {
    try {
      this.logger.log(debugLvl, 'CREATE TURN CONNECTION');

      const accountSid = process.env.TWILIO;
      const authToken = process.env.TWILLO_TOKEN;
      // this.logger.verbose(accountSid, authToken);
      const client = twilio(accountSid, authToken);

      return client.tokens
        .create();
    } catch (e) {
      console.error(e);
      return null;
    }
  }



  invalidHex(hex){
   return !(/[0-9A-Fa-f].*/.test(hex));
  }

  initiatorIncomming(socket, details) {
    try {
      this.logger.log(debugLvl, 'INITIATOR CONNECTION');
      if(this.invalidHex(socket.id)) throw new Error("Connection attempted to pass an invalid socket ID")
      this.redis.createConnectionEntry(details, socket.id)
        .then(_result => {
          socket.join(details.connId);
        });

    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  receiverIncomming(socket, details) {
    try {
      this.logger.log(debugLvl, 'RECEIVER CONNECTION');
      if(this.invalidHex(details.connId)) throw new Error("Connection attempted to pass an invalid connection ID")

      this.redis.locateMatchingConnection(details.connId)
        .then(_result =>{
          if (_result /* && connInstance.verifySig(details.signed) */) {
            // this.logger.log(sillyLvl, connInstance);
            this.logger.log(sillyLvl, details);
            // emit #1 handshake  (listener: receiver peer)
            this.redis.getConnectionEntry(details.connId)
              .then(_result =>{
                socket.emit(signal.handshake, { toSign: _result.message });
              })
          } else {
            this.logger.log(debugLvl, `NO INITIATOR CONNECTION FOUND FOR ${details.connId}`);
            this.logger.log(sillyLvl, 'current client map: ', this.clients);
            console.log(`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`); // todo remove dev item
            socket.emit(signal.invalidConnection); // emit InvalidConnection
          }
        })

    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  // This may now be redundant
  receiverConfirm(socket, details) {
    try {
      this.logger.log(debugLvl, 'RECEIVER CONFIRM');
      if(this.invalidHex(details.connId)) throw new Error("Connection attempted to pass an invalid connection ID")
      // const connInstance = this.locateMatchingConnection(details.connId);
      this.redis.locateMatchingConnection(details.connId)
        .then(_result =>{
          if (_result) {
            this.redis.verifySig(details.connId, details.signed)
              .then(_result =>{
                if (_result) {
                  socket.join(details.connId);
                  this.logger.log(debugLvl, 'PAIR CONNECTION VERIFIED');
                  this.redis.updateConnectionEntry(details.connId, socket.id)
                    .then(_result =>{
                      if (_result) {
                        if (Reflect.has(details, 'version')) {
                          // emit #2  confirmation (listener: initiator peer)
                          socket.to(details.connId).emit(signal.confirmation, {
                            connId: details.connId,
                            version: details.version,
                          });
                        } else {
                          // emit #2  confirmation (listener: initiator peer)
                          socket.to(details.connId).emit(signal.confirmation, { connId: details.connId });
                        }
                      } else {
                        // emit confirmationFailedBusy
                        console.log('CONFIRMATION FAILED: BUSY'); // todo remove dev item
                        socket.to(details.connId).emit(signal.confirmationFailedBusy);
                      }
                    })
                  // const canUpdate = connInstance.updateConnectionEntry(socket.id);

                } else {
                  this.logger.log(debugLvl, 'CONNECTION VERIFY FAILED');
                  console.log('CONNECTION VERIFY FAILED'); // todo remove dev item
                  socket.emit(signal.confirmationFailed); // emit confirmationFailed
                }
              })

          } else {
            this.logger.log(sillyLvl, 'current client map: ', this.clients);
            this.logger.log(debugLvl, 'NO CONNECTION DETAILS PROVIDED');
            console.log('NO CONNECTION DETAILS PROVIDED'); // todo remove dev item
            socket.emit(signal.invalidConnection); // emit InvalidConnection
          }
        })
      this.logger.log(infoLvl, 'connId', details.connId);

    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  ioConnection(socket) {
    try {
      const token = socket.handshake.query;
      const connector = token.stage || false;
      if(this.invalidHex(token.connId)) throw new Error("Connection attempted to pass an invalid connection ID")
      switch (connector) {
        case stages.initiator:
          this.initiatorIncomming(socket, token);
          break;
        case stages.receiver:
          this.receiverIncomming(socket, token);
          break;
        default:
          console.log('Invalid Stage Supplied'); // todo remove dev item
          this.logger.log(errorLvl, 'Invalid Stage Supplied');
          return;
      }

      socket.on(signal.signature, (data) => {
        this.logger.log(sillyLvl, 'receiverConfirm', data); // todo remove dev item
        this.receiverConfirm(socket, data);
      });

      socket.on(signal.offerSignal, (offerData) => {
        this.logger.log(infoLvl, 'OFFER: ', offerData);
        // emit #3 offer (listener: receiver peer)
        this.io.to(offerData.connId).emit(signal.offer, { data: offerData.data });
      });

      socket.on(signal.answerSignal, (answerData) => {
        this.logger.log(infoLvl, 'ANSWER: ', answerData);
        // emit #4 answer (listener: initiator peer)
        this.io.to(answerData.connId).emit(signal.answer, { data: answerData.data });
      });

      socket.on(signal.rtcConnected, (connId) => {
        // Clean up client record
        /*        console.log(socket.handshake); // todo remove dev item
        console.log(socket.rooms); // todo remove dev item
        console.log(socket.adapter); // todo remove dev item */
        this.redis.removeConnectionEntry(connId);
        socket.leave(connId);
        console.log('rtcConnected'); // todo remove dev item
      });

      socket.on(signal.disconnect, (reason) => {
        this.logger.log(debugLvl, 'disconnect reason', reason); // todo remove dev item
        socket.disconnect(true);
      });

      socket.on(signal.tryTurn, (connData) => {
        // emit #4 answer (listener: initiator peer)
        socket.to(connData.connId).emit(signal.attemptingTurn, { data: null });

        this.redis.locateMatchingConnection(connData.connId)
          .then(_result =>{
            /* console.log(connItem); // todo remove dev item */
            if (_result) {
              // Catch error in getting turn credentials
              try {
                this.redis.updateTurnStatus(connData.connId);
                this.createTurnConnection()
                  .then((_results) => {
                    // emit #5 turnToken (listener: both peer)
                    socket.to(connData.connId).emit(signal.turnToken, { data: _results.iceServers });
                    this.logger.log(infoLvl, `ice servers returned. token.iceServers: ${_results.iceServers}`);
                  });
              } catch (e) {
                console.error(e);
              }
            } else {
              this.logger.log(warnLvl, ' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT');
              this.logger.log(warnLvl, ` connectiono ID. data.connId: ${connData.connId}`);
            }
          })

      });
    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  listenToConn(socket, next) {
    this.logger.log(debugLvl, '-------------------- exchange Listener --------------------');
    this.logger.log(debugLvl, socket.handshake);
    this.logger.log(debugLvl, '------------------------------------------------------------');
    next();
  }
}

module.exports = SignalServer;

