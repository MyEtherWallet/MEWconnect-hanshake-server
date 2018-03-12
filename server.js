"use strict";
//todo look into refactoring to accept plug-in testing data, and/or testing tools

const fs = require('fs');
const path = require("path");
let options;
if(process.env.LOGNAME === "ubuntu"){
    options = {
        key: fs.readFileSync("/home/ubuntu/mew-signer-hs/test/simpleExpressTestServer/devCert.key"),
        cert: fs.readFileSync("/home/ubuntu/mew-signer-hs/test/simpleExpressTestServer/devCert.cert"),
        requestCert: false,
        rejectUnauthorized: false
    };
} else {
    options = {
        key: fs.readFileSync(path.join("test/simpleExpressTestServer/devCert.key")),
        cert: fs.readFileSync(path.join("test/simpleExpressTestServer/devCert.cert")),
        requestCert: false,
        rejectUnauthorized: false
    };
}

const server = require('https').createServer(options);
// const server = require("http").createServer();
const io = require("socket.io")(server, {
    serveClient: false,
    secure: true
});
const port = process.env.PORT || 3001;
let mewCrypto = require("./serverMewCrypto");
let ServerConnection = require("./serverConnection");

// let checkNumber, offerMsg, pubKey;

let clients = new Map();
let connected = [];

server.listen(port, () => {
    logger("Listening on " + port);
});


// io.use((socket, next) => {
//   logger("-------------------- exchange Listener --------------------");
//   logger(socket.handshake);
//   logger("------------------------------------------------------------");
//   next();
// });

io.use((socket, next) => {
    //todo check for collisions, inform, and update client
    next();
});


io.on("connection", ioConnection);


function ioConnection(socket) {
    try {
        let token = socket.handshake.query;
        let connector = token.stage || false;
        switch (connector) {
            case "initiator":
                initiatorIncomming(socket, token);
                break;
            case "receiver":
                receiverIncomming(socket, token);
                break;
            default:
                console.log("WTF");
                break;
        }

        socket.on("signature", data => {
            receiverConfirm(socket, data);
        });

        socket.on("offerSignal", data => {
            logger("OFFER", data);
            io.to(data.connId).emit("offer", {data: data.data}); // emit #3 offer (listener: receiver peer)
        });

        socket.on("answerSignal", data => {
            logger("answer", data);
            io.to(data.connId).emit("answer", {data: data.data}); // emit #4 answer (listener: initiator peer)
        });

        socket.on("rtcConnected", data => {
            let cleanUpOk = clients.delete(data);
            if (!cleanUpOk) {
                logger("connection details already clean or error cleaning up closed connection details");
            } else { // not really necessary if clean up was ok
                logger("connection details removed");
            }
        });

        socket.on("disconnect", reason => {
            console.log("disconnect reason", reason);
            socket.disconnect(true);
        })
    } catch (e) {
        console.error(e);
    }
}

function initiatorIncomming(socket, details) {
    try {
        console.error("CREATING CONNECTION");
        console.log("CREATING DETAILS: ", details);
        createConnectionEntry(details, socket.id);
        socket.join(details.connId);
    } catch (e) {
        console.error(e);
    }
}

function receiverIncomming(socket, details) {
    try {
        console.error("RECEIVER CONNECTION");
        let connInstance = locateMatchingConnection(details.connId);
        if (connInstance) {
            socket.emit("handshake", {toSign: connInstance.message}) // emit #1 handshake  (listener: receiver peer)
        } else {
            logger(clients);
            console.error("NO CONNECTION DETAILS");
            socket.emit("InvalidConnection"); // emit InvalidConnection
        }
    } catch (e) {
        console.error(e);
    }
}

function receiverConfirm(socket, details) {
    try {
        console.error("RECEIVER CONFIRM");
        console.log("RECEIVER CONFIRM DETAILS: ", details);
        let connInstance = locateMatchingConnection(details.connId);
        logger(details.connId);
        if (connInstance) {
            if (connInstance.verifySig(details.signed)) {
                socket.join(details.connId);
                logger("PAIR CONNECTION VERIFIED");
                let canUpdate = connInstance.updateConnectionEntry(socket.id);
                if (canUpdate) {
                    socket.to(details.connId).emit("confirmation", {connId: connInstance.connId}) // emit #2  confirmation (listener: initiator peer)
                } else {
                    socket.to(details.connId).emit("confirmationFailedBusy"); // emit confirmationFailedBusy
                }
            } else {
                console.error("CONNECTION VERIFY FAILED");
                socket.emit("confirmationFailed"); // emit confirmationFailed
            }
        } else {
            logger(clients);
            console.error("NO CONNECTION DETAILS");
            socket.emit("InvalidConnection"); // emit InvalidConnection
        }
    } catch (e) {

    }

}


function createConnectionEntry(details, socketId) {
    try {
        console.log(details);
        details.initiator = socketId;
        let connectionInstance = new ServerConnection(details);
        clients.set(details.connId, connectionInstance);
        logger(clients);
    } catch (e) {
        console.error(e);
    }
}


function locateMatchingConnection(connId) {
    try {
        logger(clients);
        if (clients.has(connId)) {
            return clients.get(connId);
        } else {
            console.error("NO MATCHING CONNECTION");
            return false;
        }
    } catch (e) {
        console.error(e);
    }
}

//======= Utility Functions ==============

function bufferToConnId(buf) {
    return buf.toString("hex").slice(32);
}

function keyToConnId(key) {
    return key.slice(32)
}

function logger(tag, content) {
    if (!content) {
        console.log(tag);
    } else {
        console.log(tag, content)
    }
}

