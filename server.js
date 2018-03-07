"use strict";
//todo look into refactoring to accept plug-in testing data, and/or testing tools
const http = require("http").createServer();
const io = require("socket.io")(http);
const port = process.env.PORT || 3001;


let mewCrypto = require("./mewCrypto");
let utils = require("./utils");
let bufferToConnId = utils.bufferToConnId;
let keyToConnId = utils.keyToConnId;
let logger = utils.logger;

// let checkNumber, offerMsg, pubKey;
let clients = new Map();
let connected = [];

http.listen(port, () => {
  logger("Listening on " + port);
});


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
  let token = socket.handshake;
  //todo check for collisions, inform, and update client
  socket.join(token.query.connId);
  next();
});

io.on("connection", ioConnection);


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



