"use strict";
const express = require("express");
const app = new express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const port = process.env.PORT || 3001;

let checkNumber, offerMsg, socket;
let clients = {};

io.use((socket, next) => {
  let token = socket.handshake;
  logger("token", token);
  //todo check for collisions, inform, and update client
  clients[token.query.connId] = token.query.connId;
  socket.join(token.query.connId);
  next();
});


io.use((socket, next) => {
  next();
});

io.on("connection", connect);

http.listen(port, () => {
  logger("Listening on " + port);
});


function connect(socket) {
  let rooms = Object.keys(socket.rooms);
  logger("rooms", rooms);
  logger("connected");

  logger(socket.id);
  socket.on("check", check);

  socket.on("offer", onOffer);

  socket.on("answer", msg => {
    io.emit("answer", msg);
  });

  socket.on("disconnect", function(reason){
    logger(reason);
  });


  function check(num) {
    logger("check number", num);
    if (Number.parseInt(num.data, 10) === checkNumber) {
      logger("Confirmation Success");
      socket.emit("offer", offerMsg);
    } else {
      logger("Confirmation Fail");
      socket.emit("confirmFail", {data: "confirmFail"});
    }
  }

  function onOffer(msg) {
    checkNumber = msg.confirm;
    offerMsg = msg.data;
    logger("checkNumber", checkNumber);
  }
}


function logger(tag, content) {
  if(!content){
    console.log(tag);
  } else {
    console.log(tag, content)
  }

}

//========================================= Experiment =======================================
