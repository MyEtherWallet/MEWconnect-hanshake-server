"use strict";

// const socket = io.connect("https://salty-ocean-27014.herokuapp.com/");

let connectionState = document.getElementById("connState");
let disconnectBtn = document.getElementById("disconnect");
let initiateRTCBtn = document.getElementById("initiateRTC");
let testRTCBtn = document.getElementById("testRTC");
let checkNumber = document.getElementById("checkNumber");
let begin = document.getElementById("begin");
let sendRtcMessageBtn = document.getElementById("sendRtcMessage");

initiateRTCBtn.disabled = true;
disconnectBtn.disabled = true;
testRTCBtn.disabled = true;
begin.disabled = false;
sendRtcMessageBtn.disabled = true;

begin.addEventListener("click", initiateSocketConnection);

initiateRTCBtn.addEventListener("click", initiateRtcConnection);

sendRtcMessageBtn.addEventListener("click", function() {
	sendRtcMessage(document.getElementById("rtcMessageInput").value);
	document.getElementById("rtcMessageInput").value = "";
});

testRTCBtn.addEventListener("click", testRTC);

disconnectBtn.addEventListener("click", disconnectRTC);

function initiateSocketConnection() {
	socket = initiatorCall("http://localhost:3001");
	socket.on("webC", initiateRtcConnection);
}

function initiateRtcConnection() {
	initiateRTC(socket, signalListener(socket));
}

function signalListener(socket) {
	initiateRtcButtonState();
	return function offerEmmiter(data) {
		logger("SIGNAL", JSON.stringify(data));
		send = JSON.stringify(data);
		socket.emit("offer", { data: send, confirm: addr });
	};
}

document.addEventListener("checkNumber", function(event) {
	checkNumber.textContent = event.detail;
	console.log(event);
});
document.addEventListener("SocketConnectedEvent", initiateSocketButtonState);
document.addEventListener("RtcInitiatedEvent", initiateRtcButtonState);
document.addEventListener("RtcConnectedEvent", rtcConnectButtonState);
document.addEventListener("RtcDisconnectEvent", disconnectRtcButtonState);
document.addEventListener("RtcClosedEvent", rtcCloseButtonState);
document.addEventListener("RtcMessageEvent", function(evt) {
	console.log(evt);
	document.getElementById("RtcMessage").textContent = evt.detail;
});

function initiateSocketButtonState() {
	initiateRTCBtn.disabled = false;
	disconnectBtn.disabled = true;
	testRTCBtn.disabled = true;
	begin.disabled = true;
}

function initiateRtcButtonState() {
	initiateRTCBtn.disabled = true;
	disconnectBtn.disabled = false;
	testRTCBtn.disabled = false;
	begin.disabled = true;
}

function rtcConnectButtonState() {
	connectionState.textContent = "WebRTC Connected";
	sendRtcMessageBtn.disabled = false;
}

function rtcCloseButtonState() {
	document.getElementById("connState").textContent = "Connection Closed";
	checkNumber.textContent = "";
	sendRtcMessageBtn.disabled = true;
	initiateRTCBtn.disabled = true;
	disconnectBtn.disabled = true;
	testRTCBtn.disabled = true;
	begin.disabled = false;
}

function disconnectRtcButtonState() {
	checkNumber.textContent = "";
	initiateRTCBtn.disabled = false;
	disconnectBtn.disabled = true;
	testRTCBtn.disabled = true;
}
