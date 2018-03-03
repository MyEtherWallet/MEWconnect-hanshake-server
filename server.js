"use strict";
const express = require("express");
const app = new express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const port = process.env.PORT || 3001;

io.on("connection", socket => {
  console.log("connected");
  io.emit("test", {data: "test"});
  // console.log(socket);
  socket.on("offer", msg => {
    console.log(msg);
    io.emit("offer", msg);
  });

  socket.on("answer", msg => {
    console.log(msg);
    io.emit("answer", msg);
  });
});

http.listen(port, () => {
  console.log("Listening on " + port);
});
