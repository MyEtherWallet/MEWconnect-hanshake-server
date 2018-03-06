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
	socket.on("check", check);

	socket.on("offer", onOffer);

	socket.on("answer", msg => {
		io.emit("answer", msg);
	});

	socket.on("disconnect", function(reason) {
		logger(reason);
	});

	function check(num) {
		socket.emit("offer", offerMsg);
	}

	function onOffer(msg) {
		checkNumber = msg.confirm;
		offerMsg = msg.data;
	}
}

function logger(tag, content) {
	if (!content) {
		console.log(tag);
	} else {
		console.log(tag, content);
	}
}

//========================================= Experiment =======================================
