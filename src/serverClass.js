// todo look into refactoring to accept plug-in testing data, and/or testing tools
import dotenv from 'dotenv';
import debug from 'debug';
import createLogger from 'logging';
import twilio from 'twilio';
import http from 'http';
import socketIO from 'socket.io';
import redisAdapter from 'socket.io-redis';

import RedisClient from './redisClient';
import { redis, server, socket, signal, stages } from './config';

dotenv.config();

const errorLogger = createLogger('SignalServer:ERROR');
const infoLogger = createLogger('SignalServer:INFO');

debug.log = console.log.bind(console);
const initiatorLog = debug('signal:initiator');
const receiverLog = debug('signal:receiver');
const turnLog = debug('signal:turn');
const verbose = debug('signal:verbose');
const extraverbose = debug('verbose');

export default class SignalServer {
  constructor(options = {}) {
    options.server = options.server || {};
    options.redis = options.redis || {};
    this.clients = options.clients || new Map();
    this.port = options.server.port || server.port;
    this.host = options.server.host || server.host;

    this.server = http.createServer();

    const redisOptions = options.redis.port ? options.redis : redis;
    this.redis = new RedisClient(redisOptions);

    this.io = socketIO(this.server, options.socket || socket);
    if (options.redis) this.io.adapter(redisAdapter({
      host: options.redis.host || redis.host,
      port: options.redis.port || redis.port
    }));
    this.server.listen({host: this.host, port: this.port}, () => {
      infoLogger.info(`Listening on ${this.server.address().address}:${this.port}`);
    });

    this.io.on(signal.connection, this.ioConnection.bind(this));
  }

  static create(options) {
    // if no options object is provided then the options set in the config are used
    return new SignalServer(options);
  }

  createTurnConnection() {
    try {
      turnLog('CREATE TURN CONNECTION');
      const accountSid = process.env.TWILIO;
      const authToken = process.env.TWILLO_TOKEN;
      const client = twilio(accountSid, authToken);
      return client.tokens
        .create();
    } catch (e) {
      errorLogger.error(e);
      return null;
    }
  }

  invalidHex(hex) {
    return !(/[0-9A-Fa-f].*/.test(hex));
  }

  initiatorIncomming(socket, details) {
    try {
      initiatorLog(`INITIATOR CONNECTION with connection ID: ${details.connId}`);
      extraverbose('Iniator details: ', details);
      if (this.invalidHex(socket.id)) throw new Error('Connection attempted to pass an invalid socket ID');
      this.redis.createConnectionEntry(details, socket.id)
        .then(() => {
          socket.join(details.connId);
        });
    } catch (e) {
      errorLogger.error('initiatorIncomming', {e});
    }
  }

  receiverIncomming(socket, details) {
    try {
      receiverLog(`RECEIVER CONNECTION for ${details.connId}`);
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');

      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          if (_result) {
            verbose(_result);
            this.redis.getConnectionEntry(details.connId)
              .then(_result => {
                socket.emit(signal.handshake, {toSign: _result.message});
              });
          } else {
            receiverLog(`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`);
            socket.emit(signal.invalidConnection);
          }
        });
    } catch (e) {
      errorLogger.error('receiverIncoming', {e});
    }
  }

  receiverConfirm(socket, details) {
    try {
      receiverLog('RECEIVER CONFIRM: ', details.connId);
      if (this.invalidHex(details.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
      this.redis.locateMatchingConnection(details.connId)
        .then(_result => {
          receiverLog(`Located Matching Connection for ${details.connId}`);
          verbose(_result);
          if (_result) {
            this.redis.verifySig(details.connId, details.signed)
              .then(_result => {
                if (_result) {
                  socket.join(details.connId);
                  receiverLog(`PAIR CONNECTION VERIFICATION COMPLETED for ${details.connId}`);
                  this.redis.updateConnectionEntry(details.connId, socket.id)
                    .then(_result => {
                      if (_result) {
                        receiverLog(`Updated connection entry for ${details.connId}`);
                        socket.to(details.connId).emit(signal.confirmation, {
                          connId: details.connId,
                          version: details.version
                        });
                      } else {
                        receiverLog(`CONFIRMATION FAILED: BUSY for connection ID ${details.connId}`);
                        socket.to(details.connId).emit(signal.confirmationFailedBusy);
                      }
                    })
                    .catch(error => {
                      errorLogger.error('receiverConfirm:updateConnectionEntry', {error});
                    });
                } else {
                  receiverLog(`CONNECTION VERIFY FAILED for ${details.connId}`);
                  socket.emit(signal.confirmationFailed);
                }
              })
              .catch(error => {
                errorLogger.error('receiverConfirm:verifySig', {error});
              });
          } else {
            receiverLog(`INVALID CONNECTION DETAILS PROVIDED for ${details.connId}`);
            socket.emit(signal.invalidConnection);
          }
        })
        .catch(error => {
          errorLogger.error('receiverConfirm:locateMatchingConnection', {error});
        });
    } catch (e) {
      errorLogger.error('receiverConfirm', {e});
    }
  }

  ioConnection(socket) {
    try {
      const token = socket.handshake.query;
      const connector = token.stage || false;
      if (this.invalidHex(token.connId)) throw new Error('Connection attempted to pass an invalid connection ID');
      switch (connector) {
        case stages.initiator:
          initiatorLog('Initiator stage identifier recieved');
          this.initiatorIncomming(socket, token);
          break;
        case stages.receiver:
          receiverLog('Receiver stage identifier recieved');
          this.receiverIncomming(socket, token);
          break;
        default:
          errorLogger.error('Invalid Stage Supplied');
          return;
      }

      socket.on(signal.signature, (data) => {
        verbose(`${signal.signature} signal Recieved for ${data.connId} `);
        extraverbose('Recieved: ', signal.signature);
        this.receiverConfirm(socket, data);
      });

      socket.on(signal.offerSignal, (offerData) => {
        verbose(`${signal.offerSignal} signal Recieved for ${offerData.connId} `);
        this.io.to(offerData.connId).emit(signal.offer, {data: offerData.data});
      });

      socket.on(signal.answerSignal, (answerData) => {
        verbose(`${signal.answerSignal} signal Recieved for ${answerData.connId} `);
        this.io.to(answerData.connId).emit(signal.answer, {data: answerData.data});
      });

      socket.on(signal.rtcConnected, (connId) => {
        // Clean up client record
        verbose(`Removing connection entry for: ${connId}`);
        this.redis.removeConnectionEntry(connId);
        socket.leave(connId);
        verbose('WebRTC CONNECTED', connId);
      });

      socket.on(signal.disconnect, (reason) => {
        verbose('disconnect reason: ', reason);
        socket.disconnect(true);
      });

      socket.on(signal.tryTurn, (connData) => {
        turnLog(`${signal.tryTurn} signal Recieved for ${connData.connId} `);
        this.io.to(connData.connId).emit(signal.attemptingTurn, {data: null});

        this.redis.locateMatchingConnection(connData.connId)
          .then(_result => {
            if (_result) {
              // Catch error in getting turn credentials
              try {
                turnLog(`Update TURN status for ${connData.connId}`);
                this.redis.updateTurnStatus(connData.connId);
                this.createTurnConnection()
                  .then((_results) => {
                    turnLog(`Turn Credentials Retrieved for ${connData.connId}`);
                    this.io.to(connData.connId).emit(signal.turnToken, {data: _results.iceServers});
                    turnLog(`ice servers returned. token.iceServers: ${_results.iceServers}`);
                  })
                  .catch(error => {
                    turnLog(`Error: createTurnConnectionr ${connData.connId} `);
                    errorLogger.error('ioConnection:createTurnConnection', {error});
                  });
              } catch (e) {
                errorLogger.error('ioConnection:createTurnConnection', {e});
              }
            } else {
              errorLogger.error(' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT');
              turnLog(`Failed to locate matching connection for TURN connection attempt with connection ID ${connData.connId}`);
            }
          })
          .catch(_error => {
            errorLogger.error('Error locateMatchingConnection \n', _error);
            turnLog(`locateMatchingConnection threw an error looking for connection ID: ${connData.connId}`);
          });
      });
    } catch (e) {
      errorLogger.error('ioConnection:createTurnConnection', {e});
    }
  }
}
