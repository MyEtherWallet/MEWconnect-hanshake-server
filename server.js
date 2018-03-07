"use strict";
//todo look into refactoring to accept plug-in testing data, and/or testing tools
const server = require("http").createServer();
const io = require("socket.io")(server, {
  serveClient: false
});
const port = process.env.PORT || 3001;


let mewCrypto = require("./mewCrypto");
let utils = require("./utils");
let bufferToConnId = utils.bufferToConnId;
let keyToConnId = utils.keyToConnId;
let logger = utils.logger;

// let checkNumber, offerMsg, pubKey;
/**
 * Record of current related and partial (one side connected) connection pairs including informational and confirmation details
 * @type {Map<String, Object>}
 */
let clients = new Map();
let connected = [];

server.listen(port, () => {
  logger("Listening on " + port);
});

/**
 * @typedef connDetails
 * @type {object}
 * @property {string} connId - connection id (based off of the public key)
 * @property {buffer} pub - public key
 * @property {buffer} pvt - private key
 * @property {string} initiator - socket id of the connection initiating the connection
 * @property {string} receiver - socket id of the connection receiving the connection
 */
/**
 *
 * @param {object} keys - 'map' of public private keys in the form {pub: <buffer>, pvt: <buffer>}
 * @param {string} socketId - the socket.id of the connection initiation the interaction
 * @returns {connDetails}
 */
function createConnectionEntry(keys, socketId) {
  let initDetails = {
    connId: bufferToConnId(keys.pub),
    pub: keys.pub,
    pvt: keys.pvt,
    initiator: socketId,
    receiver: undefined
  };
  clients.set(bufferToConnId(keys.pub), initDetails);
  return initDetails;
}

/**
 *
 * @param {object} connEntry - object consisting of {{connId: <String>, pub: <buffer>, pvt: <buffer>, initiator: <String>, receiver: undefined}}
 * @param {string} socketId - the socket.id of the connection receiving the interaction
 * @returns {boolean}
 */
function updateConnectionEntry(connEntry, socketId) {
  console.log(connEntry);
  // ensure only one connection pair exists.  Cause any additional/further attempts to fail.
  if (connEntry.receiver) {
    return false;
  } else {
    // update connection entry with socket id of receiver connection
    connEntry.receiver = socketId;
    clients.set(connEntry.connId, connEntry);
    return true;
  }
}

/**
 *
 * @param {string} connId - the first 32 bytes of the public key (used to differentiate and relate connection pairs)
 * @returns {connDetails | boolean}
 */
function locateMatchingConnection(connId) {
  if (clients.has(connId)) {
    return clients.get(connId);
  } else {
    console.error("NO MATCHING CONNECTION");
    return false;
  }
}

// io.use((socket, next) => {
//   logger("-------------------- exchange Listener --------------------");
//   logger(socket.handshake);
//   logger("------------------------------------------------------------");
//   next();
// });


io.use((socket, next) => {
  // let token = socket.handshake;
  //todo check for collisions, inform, and update client
  // socket.join(token.query.connId);
  next();
});

/**
 *  connection event.  ioConnection called for each new connection.
 */
io.on("connection", ioConnection);

//<Object <Socket.io socket object>>
/**
 *
 * @param {Object} socket
 * @returns {Promise<void>}
 */
async function ioConnection(socket) {
  let token = socket.handshake;
  let peerConnId = token.query.connId || false;
  if (peerConnId) {
    let connDetails = locateMatchingConnection(keyToConnId(peerConnId));
    if (connDetails) {
      logger(peerConnId);
      if (mewCrypto.verifyKey(peerConnId, connDetails.pvt)) {
        socket.join(keyToConnId(peerConnId));
        logger("PAIR CONNECTION VERIFIED");
        let canUpdate = updateConnectionEntry(connDetails, socket.id);
        console.log(canUpdate);
        if(canUpdate) {
          socket.to(keyToConnId(peerConnId)).emit("confirmation", {connId: connDetails.connId}) // emit #2  confirmation (listener: initiator peer)
        } else {
          socket.to(keyToConnId(peerConnId)).emit("confirmationFailedBusy"); // emit confirmationFailedBusy
        }
      } else {
        console.error("CONNECTION VERIFY FAILED");
        socket.to(keyToConnId(peerConnId)).emit("confirmationFailed"); // emit confirmationFailed
      }
    } else {
      logger(clients);
      console.error("NO CONNECTION DETAILS");
      socket.to(keyToConnId(peerConnId)).emit("InvalidConnection"); // emit InvalidConnection
    }

  } else {
    console.error("CREATING CONNECTION");
    let keyPair = await mewCrypto.prepareKey();
    let details = await createConnectionEntry(keyPair, socket.id);
    socket.join(details.connId);
    io.to(details.connId).emit("handshake", {connId: details.connId, key: keyPair.pub.toString("hex")}) // emit #1 handshake  (listener: initiator peer)
  }

  socket.on("offerSignal", (data) => {
    logger("OFFER", data);
    io.to(data.connId).emit("offer", {data: data.data}); // emit #3 offer (listener: receiver peer)
  });

  socket.on("answerSignal", (data) => {
    logger("answer", data);
    io.to(data.connId).emit("answer", {data: data.data}); // emit #4 answer (listener: initiator peer)
  });

  socket.on("rtcConnected", (data) =>{
    let cleanUpOk = clients.delete(data);
    if(!cleanUpOk){
      logger("connection details already clean or error cleaning up closed connection details");
    } else { // not really necessary if clean up was ok
      logger("connection details removed");
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("disconnect reason", reason);
    socket.disconnect(true);
    // console.log(socket);
  })

}



