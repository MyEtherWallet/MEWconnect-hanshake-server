// ========================== Common Functions ========================================
let p, send, socket, socketKey;
const addr = "0x00450992BC72AB99Ae55BcCdcE68E160412fdaC0";

// sends a hardcoded message through the rtc connection
function testRTC(msg) {
	p.send(JSON.stringify({ type: 2, text: msg }));
	// p.send(JSON.stringify({type: 2, text: "Sent Via RTC From Web Peer"}));
}

// sends a message through the rtc connection
function sendRtcMessage(msg) {
	console.log(msg);
	p.send(JSON.stringify({ type: 1, text: msg }));
}

/*
* Disconnect the current RTC connection
*/
function disconnectRTC() {
	signalStateChange("RtcDisconnectEvent");
	p.destroy();
}

/*
* Emits events on the document for various stages of the process
* Emits the numbers on the initiator side that need to be entered on the
* receiver side to allow the connection.
* ( otherwise they are basically just for display and user feedback purposes)
*/
function signalStateChange(event, data) {
	switch (event) {
		case "RtcDisconnectEvent":
			document.dispatchEvent(new Event("RtcDisconnectEvent"));
			break;
		case "RtcConnectedEvent":
			document.dispatchEvent(new Event("RtcConnectedEvent"));
			break;
		case "RtcClosedEvent":
			document.dispatchEvent(new Event("RtcClosedEvent"));
			break;
		case "RtcInitiatedEvent":
			document.dispatchEvent(new Event("RtcInitiatedEvent"));
			break;
		case "SocketConnectedEvent":
			document.dispatchEvent(new Event("SocketConnectedEvent"));
			break;
		case "confirmationFailedEvent":
			document.dispatchEvent(new Event("confirmationFailedEvent"));
			break;
		case "RtcSignalEvent":
			document.dispatchEvent(new Event("RtcSignalEvent"));
			break;
		case "RtcMessageEvent":
			document.dispatchEvent(
				new CustomEvent("RtcMessageEvent", { detail: data })
			);
			break;
		case "checkNumber":
			document.dispatchEvent(new CustomEvent("checkNumber", { detail: data }));
			break;
	}
}

/*// misc. function
function handleJData(data){
  switch(data.type){
    case 1:
      console.log("handleJData", data);
      signalStateChange("RtcMessageEvent", data.text);
      break;
    case 2:
      logger("RECEIVED: ", data.text);
      break;
    default:
      logger("default", data);
      break;
  }
}*/

// misc function
function logger(tag, err) {
	if (!err) {
		console.log(tag);
	} else {
		console.log(tag, err);
	}
}
