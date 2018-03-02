"use strict";
const express = require("express");
const app = new express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const port = process.env.PORT || 3001;

io.on("connection", socket => {
  socket.on("chat message", msg => {
    io.emit("chat message", msg);
  });
});

http.listen(port, () => {
  console.log("Listening on " + port);
});
