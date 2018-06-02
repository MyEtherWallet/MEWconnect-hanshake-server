// todo look into refactoring to accept plug-in testing data, and/or testing tools
require('dotenv').config();
const {signal, stages, loggerLevels} = require('./signals');
const {errorLvl, warnLvl, infoLvl, verboseLvl, debugLvl, sillyLvl} = loggerLevels;
const twilio = require('twilio');
const ServerConnection = require('./serverConnection');
const https = require('https');
const socketIO = require('socket.io');
const port = process.env.PORT || 3001;



class SignalServer {
  constructor(options) {
    this.loggerLevels = loggerLevels;
    this.logger = options.logger || {log(){}};
    this.clients = options.clients || new Map();
    if(!options.server) throw new Error("No config provided for server")
    if(!options.socket) throw new Error("No config provided for socket.io")
    this.server = https.createServer(options.server);
    this.io = socketIO(this.server, options.socket);

    this.server.listen(port, () => {
      console.log(`Listening on ${port}`);
    });

    this.io.use(this.listenToConn.bind(this)); // debuging usage (non-functional)
    this.io.use((socket, next) => {
      this.logger.log(sillyLvl, socket);
      next();
    });

    this.io.on(signal.connection, this.ioConnection.bind(this));
  }

  static create(options){
    return new SignalServer(options);
  }

  createTurnConnection() {
    this.logger.log(debugLvl, 'CREATE TURN CONNECTION');

    const accountSid = process.env.TWILIO;
    const authToken = process.env.TWILLO_TOKEN;
    logger.verbose(accountSid, authToken);
    const client = twilio(accountSid, authToken);

    return client.tokens
      .create();
  }

  createConnectionEntry(details, socketId) {
    try {
      this.logger.log(debugLvl, 'CREATING CONNECTION');
      // eslint-disable-next-line no-param-reassign
      details.initiator = socketId;
      const connectionInstance = new ServerConnection(details);
      this.clients.set(details.connId, connectionInstance);
      this.logger.log(sillyLvl,'current client map: ', this.clients);
    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  locateMatchingConnection(connId) {
    this.logger.log(sillyLvl,'current client map: ', this.clients);
    if (this.clients.has(connId)) {
      this.logger.log(debugLvl, 'CONNECTION FOUND');
      return this.clients.get(connId);
    }
    this.logger.log(debugLvl, 'NO MATCHING CONNECTION');
    return false;
  }

  initiatorIncomming(socket, details) {
    try {
      this.createConnectionEntry(details, socket.id);
      socket.join(details.connId);
    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  receiverIncomming(socket, details) {
    try {
      this.logger.log(debugLvl, 'RECEIVER CONNECTION');
      const connInstance = this.locateMatchingConnection(details.connId);
      if (connInstance) {
        // emit #1 handshake  (listener: receiver peer)
        socket.emit(signal.handshake, {toSign: connInstance.message});
      } else {
        this.logger.log(debugLvl,`NO INITIATOR CONNECTION FOUND FOR ${details.connId}`);
        this.logger.log(sillyLvl,'current client map: ', this.clients);
        socket.emit(signal.invalidConnection); // emit InvalidConnection
      }
    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  receiverConfirm(socket, details) {
    try {
      this.logger.log(debugLvl, 'RECEIVER CONFIRM');
      const connInstance = this.locateMatchingConnection(details.connId);
      this.logger.log(infoLvl, 'connId', details.connId);
      if (connInstance) {
        if (connInstance.verifySig(details.signed)) {
          socket.join(details.connId);
          this.logger.log(debugLvl, 'PAIR CONNECTION VERIFIED');
          const canUpdate = connInstance.updateConnectionEntry(socket.id);
          if (canUpdate) {
            // emit #2  confirmation (listener: initiator peer)
            socket.to(details.connId).emit(signal.confirmation, {connId: connInstance.connId});
          } else {
            // emit confirmationFailedBusy
            socket.to(details.connId).emit(signal.confirmationFailedBusy);
          }
        } else {
          this.logger.log(debugLvl, 'CONNECTION VERIFY FAILED');
          socket.emit(signal.confirmationFailed); // emit confirmationFailed
        }
      } else {
        this.logger.log(sillyLvl,'current client map: ', this.clients);
        this.logger.log(debugLvl, 'NO CONNECTION DETAILS PROVIDED');
        socket.emit(signal.invalidConnection); // emit InvalidConnection
      }
    } catch (e) {
      this.logger.log(errorLvl, e);
    }
  }

  ioConnection(socket) {
    try {
      const token = socket.handshake.query;
      const connector = token.stage || false;
      switch (connector) {
        case stages.initiator:
          this.initiatorIncomming(socket, token);
          break;
        case stages.receiver:
          this.receiverIncomming(socket, token);
          break;
        default:
          this.logger.log(errorLvl, 'Invalid Stage Supplied');
          break;
      }

      socket.on(signal.signature, (data) => {
        this.receiverConfirm(socket, data);
      });

      socket.on(signal.offerSignal, (offerData) => {
        this.logger.log(infoLvl, 'OFFER: ', offerData);
        // emit #3 offer (listener: receiver peer)
        this.io.to(offerData.connId).emit(signal.offer, {data: offerData.data});
      });

      socket.on(signal.answerSignal, (answerData) => {
        this.logger.log(infoLvl, 'ANSWER: ', answerData);
        // emit #4 answer (listener: initiator peer)
        this.io.to(answerData.connId).emit(signal.answer, {data: answerData.data});
      });

      socket.on(signal.rtcConnected, (connId) => {
        // Clean up client record
        this.clients.delete(connId);
        socket.leave(connId);
      });

      socket.on(signal.disconnect, (reason) => {
        this.logger.log(debugLvl, 'disconnect reason', reason); // todo remove dev item
        socket.disconnect(true);
      });

      socket.on(signal.tryTurn, (connData) => {
        // emit #4 answer (listener: initiator peer)
        socket.to(connData.connId).emit(signal.attemptingTurn, {data: null});

        const connItem = this.locateMatchingConnection(connData.connId);
        console.log(connItem); // todo remove dev item
        if (connItem !== undefined) {
          connItem.updateTurnStatus();
          this.createTurnConnection()
            .then((_results) => {
              // emit #5 turnToken (listener: both peer)
              socket.to(connData.connId).emit(signal.turnToken, {data: _results.iceServers});
              this.logger.log(infoLvl, `ice servers returned. token.iceServers: ${_results.iceServers}`);
            });
        } else {
          this.logger.log(warnLvl, ' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT');
          this.logger.log(warnLvl, ` connectiono ID. data.connId: ${connData.connId}`);
        }
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

