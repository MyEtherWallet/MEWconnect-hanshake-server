"use strict";
// Web
// const socket = io.connect("https://salty-ocean-27014.herokuapp.com/");
// const socket = io.connect("http://localhost:3001");
let connectionState = document.getElementById("connState");
let disconnectBtn = document.getElementById("disconnect");
let testRTCBtn = document.getElementById("testRTC");
let confirmNumber = document.getElementById("confirmNumber");
let submit = document.getElementById("submitConfirm");
// let begin = document.getElementById("begin");
let socketKeyBtn = document.getElementById("socketKeyBtn");
let sendRtcMessageBtn = document.getElementById("sendRtcMessage");
// let socket;

disconnectBtn.disabled = true;
testRTCBtn.disabled = true;
submit.disabled = true;
socketKeyBtn.disabled = false;
sendRtcMessageBtn.disabled = true;

sendRtcMessageBtn.addEventListener("click", function() {
	sendRtcMessage(document.getElementById("rtcMessageInput").value);
	document.getElementById("rtcMessageInput").value = "";
});

socketKeyBtn.addEventListener("click", function() {
	socketKeyButtonState();
	let options = {
		query: {
			connId: document.getElementById("socketKey").value
		}
	};
	receiverCall("http://localhost:3001", options);
});

testRTCBtn.addEventListener("click", testRTC);

disconnectBtn.addEventListener("click", disconnectRTC);

confirmNumber.addEventListener("onChange", function(evt) {
	console.log("data entered", evt);
});

submit.addEventListener("click", function() {
	let value = confirmNumber.value;
	submitConfirm(value);
});

function signalListener(socket) {
	return function answerEmmiter(data) {
		logger("signal", JSON.stringify(data));
		send = JSON.stringify(data);
		socket.emit("answer", { data: send });
		rtcSignalButtonState();
	};
}

document.addEventListener("RtcDisconnectEvent", disconnectRtcButtonState);
document.addEventListener("RtcConnectedEvent", rtcConnectButtonState);
document.addEventListener("RtcClosedEvent", rtcCloseButtonState);
document.addEventListener("RtcSignalEvent", rtcSignalButtonState);
document.addEventListener("confirmationFailedEvent", confirmedState);
document.addEventListener("RtcMessageEvent", function(evt) {
	document.getElementById("RtcMessage").textContent = evt.detail;
});

function socketKeyButtonState() {
	disconnectBtn.disabled = true;
	testRTCBtn.disabled = true;
	submit.disabled = false;
	socketKeyBtn.disabled = true;
}

function rtcConnectButtonState(evt) {
	connectionState.textContent = "WebRTC Connected";
	socketKeyBtn.disabled = true;
	sendRtcMessageBtn.disabled = false;
}

function rtcCloseButtonState() {
	connectionState.textContent = "Connection Closed";
	document.getElementById("socketKey").value = "";
	confirmNumber.value = "";
	disconnectBtn.disabled = true;
	testRTCBtn.disabled = true;
	sendRtcMessageBtn.disabled = true;
	socketKeyBtn.disabled = false;
}

function rtcSignalButtonState(evt) {
	disconnectBtn.disabled = false;
	testRTCBtn.disabled = false;
	submit.disabled = true;
	socketKeyBtn.disabled = true;
}

function disconnectRtcButtonState() {
	document.getElementById("socketKey").value = "";
	confirmNumber.value = "";
	disconnectBtn.disabled = true;
	testRTCBtn.disabled = true;
}

function confirmedState() {
	connectionState.textContent = "Confirmation Failed";
}

function sentRtcMessage() {}

// ========================== Receiver Functions ========================================
/*
* Initiates the socket connection between the receiver and the server
* The options argument is a query string consisting of the socket confirm code entered by the user
* that is used to match the two sides of the connection
*/
function receiverCall(url, options) {
	console.log("options", options);
	socket = io.connect(url, options);
	socket.emit("webC");

	/*
  * triggers rtc setup
  * sent after receiver confirm code is checked to match*/
	socket.on("offer", receiveOffer);
}

/*
* Gets the confirm number entered by the user and sends it to the server
* If the verification fails the server responds with "confirmFail"
*/
function submitConfirm(value) {
	socket.emit("check", { data: value });
	socket.on("confirmFail", function() {
		signalStateChange("confirmationFailedEvent");
	});
	// socket.on("confirmSuccess", function(){
	//
	// });
}

/*
* Processes the offer and sends the answer
*/
function receiveOffer(data) {
	logger(data);
	p = new SimplePeer({ initiator: false, trickle: false });
	p.signal(JSON.parse(data));

	p.on("error", function(err) {
		logger("error: ", err);
	});

	p.on("connect", function() {
		logger("CONNECTED");
		p.send("From Web");
		signalStateChange("RtcConnectedEvent");
		socket.disconnect();
	});

	p.on("data", function(data) {
		try {
			let jData = JSON.parse(data);
			// handleJData(jData);
		} catch (e) {
			logger("peer2 data", data.toString());
		}
	});

	p.on("close", function(data) {
		signalStateChange("RtcClosedEvent");
	});

	p.on("signal", function(data) {
		logger("signal: ", JSON.stringify(data));
		send = JSON.stringify(data);
		socket.emit("answer", { data: send });
		signalStateChange("RtcSignalEvent");
	});
}
