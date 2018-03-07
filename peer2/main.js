"use strict";

let mewConnect = new mewConnectReceiver(signalStateChange, logger);
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

sendRtcMessageBtn
  .addEventListener("click", function(){
    mewConnect.sendRtcMessage(document.getElementById("rtcMessageInput").value);
    document.getElementById("rtcMessageInput").value = "";
  });

socketKeyBtn
  .addEventListener("click", function(){
    socketKeyButtonState();
    // let options = {query: {
    //   peer: "peer2",
    //     // key: document.getElementById("socketKey").value,
    //     connId: document.getElementById("socketKey").value
    //   }};
    mewConnect.receiverCall("ws://localhost:3001", document.getElementById("socketKey").value);
  });

testRTCBtn
  .addEventListener("click", mewConnect.testRTC());

disconnectBtn
  .addEventListener("click", mewConnect.disconnectRTC());

confirmNumber
  .addEventListener("onChange", function(evt){
    console.log("data entered", evt);
  });

submit
  .addEventListener("click", function(){
    let value = confirmNumber.value;
    // submitConfirm(value);
  });

/*
function signalListener(socket){
  return function answerEmmiter(data){
    logger("signal", JSON.stringify(data));
    send = JSON.stringify(data);
    socket.emit('answer', {data: send});
    rtcSignalButtonState();
  }
}*/

document.addEventListener("RtcDisconnectEvent", disconnectRtcButtonState);
document.addEventListener("RtcConnectedEvent", rtcConnectButtonState);
document.addEventListener("RtcClosedEvent", rtcCloseButtonState);
document.addEventListener("RtcSignalEvent", rtcSignalButtonState);
document.addEventListener("confirmationFailedEvent", confirmedState);
document.addEventListener("RtcMessageEvent", function(evt){
  document.getElementById("RtcMessage").textContent = evt.detail;
});

function socketKeyButtonState(){
  disconnectBtn.disabled = true;
  testRTCBtn.disabled = true;
  submit.disabled = false;
  socketKeyBtn.disabled = true;
}

function rtcConnectButtonState(evt){
  connectionState.textContent = "WebRTC Connected";
  socketKeyBtn.disabled = true;
  sendRtcMessageBtn.disabled = false;
}

function rtcCloseButtonState(){
  connectionState.textContent = "Connection Closed";
  document.getElementById("socketKey").value = '';
  confirmNumber.value = '';
  disconnectBtn.disabled = true;
  testRTCBtn.disabled = true;
  sendRtcMessageBtn.disabled = true;
  socketKeyBtn.disabled = false;
}

function rtcSignalButtonState(evt){
  disconnectBtn.disabled = false;
  testRTCBtn.disabled = false;
  submit.disabled = true;
  socketKeyBtn.disabled = true;
}

function disconnectRtcButtonState(){
  document.getElementById("socketKey").value = '';
  confirmNumber.value = '';
  disconnectBtn.disabled = true;
  testRTCBtn.disabled = true;
}

function confirmedState(){
  connectionState.textContent = "Confirmation Failed";
}

function sentRtcMessage(){

}

// ========================== Common Functions ========================================

/*
* Emits events on the document for various stages of the process
* Emits the numbers on the initiator side that need to be entered on the
* receiver side to allow the connection.
* ( otherwise they are basically just for display and user feedback purposes)
*/
function signalStateChange(event, data){
  switch(event){
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
      document.dispatchEvent(new CustomEvent("RtcMessageEvent", {detail: data}));
      break;
    case "checkNumber":
      document.dispatchEvent(new CustomEvent("checkNumber", {detail: data}));
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
  if(!err){
    console.log(tag);
  } else {
    console.log(tag, err)
  }

}