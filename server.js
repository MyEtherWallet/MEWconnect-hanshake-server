// todo look into refactoring to accept plug-in testing data, and/or testing tools
require('dotenv').config();
const fs = require('fs');

const { signal, stages } = require('./signals');
const { logger, consoleLoggerWrap } = require('./loggers');
const twilio = require('twilio');

const consoleLogger = consoleLoggerWrap(true);

const ServerConnection = require('./serverConnection');

const clients = new Map();
const port = process.env.PORT || 3001;

const options = {
  key: fs.readFileSync('./certs/devCert.key'),
  cert: fs.readFileSync('./certs/devCert.cert'),
  requestCert: false,
  rejectUnauthorized: false,
};

const server = require('https').createServer(options);
const io = require('socket.io')(server, {
  serveClient: false,
  secure: true,
});

server.listen(port, () => {
  consoleLogger(`Listening on ${port}`);
});

function createTurnConnection() {


  const accountSid = process.env.TWILIO;
  const authToken = process.env.TWILLO_TOKEN;
  logger.verbose(accountSid, authToken);
  const client = twilio(accountSid, authToken);

  return client.tokens
    .create();
}

function createConnectionEntry(details, socketId) {
  try {
    // eslint-disable-next-line no-param-reassign
    details.initiator = socketId;
    const connectionInstance = new ServerConnection(details);
    clients.set(details.connId, connectionInstance);
    consoleLogger('current client map: ', clients);
  } catch (e) {
    logger.error(e);
  }
}

function locateMatchingConnection(connId) {
  consoleLogger('current client map: ', clients);
  if (clients.has(connId)) {

    return clients.get(connId);
  }

  return false;
}

function initiatorIncomming(socket, details) {
  try {

    createConnectionEntry(details, socket.id);
    socket.join(details.connId);
  } catch (e) {
    logger.error(e);
  }
}

function receiverIncomming(socket, details) {
  try {

    const connInstance = locateMatchingConnection(details.connId);
    if (connInstance) {
      // emit #1 handshake  (listener: receiver peer)
      socket.emit(signal.handshake, { toSign: connInstance.message });
    } else {

      consoleLogger('current client map: ', clients);
      socket.emit(signal.invalidConnection); // emit InvalidConnection
    }
  } catch (e) {
    logger.error(e);
  }
}

function receiverConfirm(socket, details) {
  try {

    const connInstance = locateMatchingConnection(details.connId);
    consoleLogger('connId', details.connId);
    if (connInstance) {
      if (connInstance.verifySig(details.signed)) {
        socket.join(details.connId);

        const didUpdate = connInstance.updateConnectionEntry(socket.id);
        if (didUpdate) {
          // emit #2  confirmation (listener: initiator peer)
          socket.to(details.connId).emit(signal.confirmation, { connId: connInstance.connId });
        } else {
          // emit confirmationFailedBusy
          socket.to(details.connId).emit(signal.confirmationFailedBusy);
        }
      } else {

        socket.emit(signal.confirmationFailed); // emit confirmationFailed
      }
    } else {
      consoleLogger('current client map: ', clients);

      socket.emit(signal.invalidConnection); // emit InvalidConnection
    }
  } catch (e) {
    logger.error(e);
  }
}

function ioConnection(socket) {
  try {
    const token = socket.handshake.query;
    const connector = token.stage || false;
    switch (connector) {
      case stages.initiator:
        initiatorIncomming(socket, token);
        break;
      case stages.receiver:
        receiverIncomming(socket, token);
        break;
      default:
        console.error('Invalid Stage');
        break;
    }

    socket.on(signal.signature, (data) => {
      receiverConfirm(socket, data);
    });

    socket.on(signal.offerSignal, (data) => {
      consoleLogger('OFFER', data);
      // emit #3 offer (listener: receiver peer)
      io.to(data.connId).emit(signal.offer, { data: data.data });
    });

    socket.on(signal.answerSignal, (data) => {
      consoleLogger('answer', data);
      // emit #4 answer (listener: initiator peer)
      io.to(data.connId).emit(signal.answer, { data: data.data });
    });

    socket.on(signal.rtcConnected, (data) => {
      // Clean up client record
      clients.delete(data);
    });

    socket.on(signal.disconnect, (reason) => {
      consoleLogger('disconnect reason', reason); // todo remove dev item
      socket.disconnect(true);
    });

    socket.on('tryTurn', (data) => {
      socket.to(data.connId).emit('attemptingTurn', { data: null }); // emit #4 answer (listener: initiator peer)
      const connItem = locateMatchingConnection(data.connId);
      if (connItem) {
        connItem.updateTurnStatus();
        createTurnConnection()
          .then((_results) => {
            socket.to(data.connId).emit('turnToken', { data: _results.iceServers }); // emit #5 turnToken (listener: both peer)
            logger.info(`ice servers returned. token.iceServers: ${_results.iceServers}`);
          });
      } else {
        logger.warn(' FAILED TO LOCATE MATCHING CONNECTION FOR TURN CONNECTION ATTEMPT');
        logger.warn(` connectiono ID. data.connId: ${data.connId}`);
      }
    });
  } catch (e) {
    logger.error(e);
  }
}

function listenToConn(socket, next) {
  consoleLogger('-------------------- exchange Listener --------------------');
  consoleLogger(socket.handshake);
  consoleLogger('------------------------------------------------------------');
  next();
}

io.use(listenToConn);
io.use((socket, next) => {
  // todo check for collisions, inform, and update client
  next();
});

io.on(signal.connection, ioConnection);

//= ====== Utility Functions ==============

// function bufferToConnId(buf) {
//   return buf.toString('hex').slice(32);
// }
//
// function keyToConnId(key) {
//   return key.slice(32);
// }

