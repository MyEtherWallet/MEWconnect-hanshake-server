"use strict";

//todo look into refactoring to accept plug-in testing data, and/or testing tools
require('dotenv').config();
const fs = require('fs');
const signal = require("./signals").signals;
const stages = require("./signals").stages;
const logger = require("./logger");
const logToConsole = true;

let options = {
    key: fs.readFileSync("./certs/devCert.key"),
    cert: fs.readFileSync("./certs/devCert.cert"),
    requestCert: false,
    rejectUnauthorized: false
};


const server = require('https').createServer(options);
const io = require("socket.io")(server, {
    serveClient: false,
    secure: true
});


console.log(consoleLogger);

const port = process.env.PORT || 3001;
let ServerConnection = require("./serverConnection");

let clients = new Map();

server.listen(port, () => {
    consoleLogger("Listening on " + port);
});



io.use(listenToConn);
io.use((socket, next) => {

    //todo check for collisions, inform, and update client
    next();
});


io.on(signal.connection, ioConnection);


function ioConnection(socket) {
    try {
        let token = socket.handshake.query;
        let connector = token.stage || false;
        switch (connector) {
            case stages.initiator:
                initiatorIncomming(socket, token);
                break;
            case stages.receiver:
                receiverIncomming(socket, token);
                break;
            default:
                console.error("Invalid Stage");
                break;
        }

        socket.on(signal.signature, data => {
            receiverConfirm(socket, data);
        });

        socket.on(signal.offerSignal, data => {
            consoleLogger("OFFER", data);
            io.to(data.connId).emit(signal.offer, {data: data.data}); // emit #3 offer (listener: receiver peer)
        });

        socket.on(signal.answerSignal, data => {
            consoleLogger("answer", data);
            io.to(data.connId).emit(signal.answer, {data: data.data}); // emit #4 answer (listener: initiator peer)
        });

        socket.on(signal.rtcConnected, data => {
            let cleanUpOk = clients.delete(data);
            if (!cleanUpOk) {
                consoleLogger("connection details already clean or error cleaning up closed connection details");
            } else { // not really necessary if clean up was ok
                consoleLogger("connection details removed");
            }
        });

        socket.on(signal.disconnect, reason => {
            consoleLogger("disconnect reason", reason); //todo remove dev item
            socket.disconnect(true);
        });

        socket.on("tryTurn", data => {
            socket.to(data.connId).emit("attemptingTurn", {data: null}); // emit #4 answer (listener: initiator peer)
            let connItem = locateMatchingConnection(data.connId);
            connItem.updateTurnStatus();
            createTurnConnection().then((token) => {
                socket.to(data.connId).emit("turnToken", {data: token.iceServers}); // emit #5 turnToken (listener: both peer)
                consoleLogger("--------------------"); //todo remove dev item
                consoleLogger("token.username: ", token.username); //todo remove dev item
                consoleLogger("token", token); //todo remove dev item
                consoleLogger("--------------------"); //todo remove dev item
            });
        });

    } catch (e) {
        logger.error(e);
    }
}


function createTurnConnection(){
    consoleLogger("CREATE TURN CONNECTION");

    const accountSid = process.env.TWILIO;
    const authToken = process.env.TWILLO_TOKEN;
    logger.verbose(accountSid, authToken);
    const client = require('twilio')(accountSid, authToken);

    return client.tokens
        .create();
}



function initiatorIncomming(socket, details) {
    try {
        consoleLogger("CREATING CONNECTION");
        createConnectionEntry(details, socket.id);
        socket.join(details.connId);
    } catch (e) {
        logger.error(e);
    }
}

function receiverIncomming(socket, details) {
    try {
        consoleLogger("RECEIVER CONNECTION");
        let connInstance = locateMatchingConnection(details.connId);
        if (connInstance) {
            socket.emit(signal.handshake, {toSign: connInstance.message}) // emit #1 handshake  (listener: receiver peer)
        } else {
            consoleLogger("current client map: ", clients);
            consoleLogger("NO CONNECTION DETAILS");
            socket.emit(signal.invalidConnection); // emit InvalidConnection
        }
    } catch (e) {
        logger.error(e);
    }
}

function receiverConfirm(socket, details) {
    try {
        consoleLogger("RECEIVER CONFIRM");
        let connInstance = locateMatchingConnection(details.connId);
        consoleLogger("connId", details.connId);
        if (connInstance) {
            if (connInstance.verifySig(details.signed)) {
                socket.join(details.connId);
                consoleLogger("PAIR CONNECTION VERIFIED");
                let canUpdate = connInstance.updateConnectionEntry(socket.id);
                if (canUpdate) {
                    socket.to(details.connId).emit(signal.confirmation, {connId: connInstance.connId}) // emit #2  confirmation (listener: initiator peer)
                } else {
                    socket.to(details.connId).emit(signal.confirmationFailedBusy); // emit confirmationFailedBusy
                }
            } else {
                consoleLogger("CONNECTION VERIFY FAILED");
                socket.emit(signal.confirmationFailed); // emit confirmationFailed
            }
        } else {
            consoleLogger("current client map: ",clients);
            consoleLogger("NO CONNECTION DETAILS");
            socket.emit(signal.invalidConnection); // emit InvalidConnection
        }
    } catch (e) {
        logger.error(e);
    }

}


function createConnectionEntry(details, socketId) {
    try {
        details.initiator = socketId;
        let connectionInstance = new ServerConnection(details);
        clients.set(details.connId, connectionInstance);
        consoleLogger("current client map: ",clients);
    } catch (e) {
        logger.error(e);
    }
}


function locateMatchingConnection(connId) {
    try {
        consoleLogger("current client map: ",clients);
        if (clients.has(connId)) {
            consoleLogger("CONNECTION FOUND");
            return clients.get(connId);
        } else {
            consoleLogger("NO MATCHING CONNECTION");
            return false;
        }
    } catch (e) {
        logger.error(e);
    }
}

//======= Utility Functions ==============

function bufferToConnId(buf) {
    return buf.toString("hex").slice(32);
}

function keyToConnId(key) {
    return key.slice(32)
}

function consoleLogger(tag, content) {
    if(logToConsole){
        if (!content) {
            console.log(tag);
        } else {
            console.log(tag, content)
        }
    } else {
        if (!content) {
            logger.verbose("TAG: " + tag);
        } else {
            logger.verbose("TAG: " + tag);
            logger.verbose(content);
        }
    }

}

function listenToConn(socket, next){
  consoleLogger("-------------------- exchange Listener --------------------");
  consoleLogger(socket.handshake);
  consoleLogger("------------------------------------------------------------");
  next();
}

