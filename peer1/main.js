"use strict";

// const socket = io.connect("https://salty-ocean-27014.herokuapp.com/");
let mewConnect = new MewConnectInitiator(signalStateChange, logger);

let connectionState = document.getElementById("connState");
let disconnectBtn = document.getElementById("disconnect");
let checkNumber = document.getElementById("checkNumber");
let begin = document.getElementById("begin");
let sendRtcMessageBtn = document.getElementById("sendRtcMessage");
let yourAddress = document.getElementById("yourAddress");
let signedMessage = document.getElementById("signedMessage");

let getAddressBtn = document.getElementById("getAddress");
let signMessageBtn = document.getElementById("signMessage");

disconnectBtn.disabled = true;
begin.disabled = false;
sendRtcMessageBtn.disabled = true;

begin
  .addEventListener("click", initiateSocketConnection);

function initiateSocketConnection(){
  // socket = initiatorCall("http://localhost:3001");
  mewConnect.initiatorCall("ws://localhost:3001");
}

sendRtcMessageBtn
  .addEventListener("click", function(){
    mewConnect.sendRtcMessage(document.getElementById("rtcMessageInput").value);
    document.getElementById("rtcMessageInput").value = "";
  });

let addType = "address";
let addMsg = "getAddress";
let msgType = "sign";
let signMsg = "signMessage";

getAddressBtn
  .addEventListener("click",
    mewConnect.sendRtcMessage(addType, addMsg).bind(event, addType, addMsg));

signMessageBtn
  .addEventListener("click", mewConnect.sendRtcMessage(msgType, signMsg).bind(event, msgType, signMsg));


let testRTCBtn = document.getElementById("testRTC");

testRTCBtn
  .addEventListener("click", mewConnect.testRTC());

disconnectBtn.addEventListener("click", mewConnect.disconnectRTC());





document.addEventListener("checkNumber", function(event){
  checkNumber.textContent = event.detail;
  console.log(event);
});
document.addEventListener("SocketConnectedEvent", initiateSocketButtonState);
document.addEventListener("RtcInitiatedEvent", initiateRtcButtonState);
document.addEventListener("RtcConnectedEvent", rtcConnectButtonState);
document.addEventListener("RtcDisconnectEvent", disconnectRtcButtonState);
document.addEventListener("RtcClosedEvent", rtcCloseButtonState);
document.addEventListener("RtcMessageEvent", function(evt){
  console.log(evt);
  document.getElementById("RtcMessage").textContent = evt.detail;
});

function initiateSocketButtonState(){
  disconnectBtn.disabled = true;
  begin.disabled = true;
}

function initiateRtcButtonState(){
  disconnectBtn.disabled = false;
  begin.disabled = true;
}

function rtcConnectButtonState(){
  connectionState.textContent = "WebRTC Connected";
  sendRtcMessageBtn.disabled = false;
}

function rtcCloseButtonState(){
  document.getElementById("connState").textContent = "Connection Closed";
  checkNumber.textContent = '';
  sendRtcMessageBtn.disabled = true;
  disconnectBtn.disabled = true;
  begin.disabled = false;
}


function disconnectRtcButtonState(){
  checkNumber.textContent = '';
  disconnectBtn.disabled = true;
}


//============================== Message Middleware ========================


mewConnect.use((data, next) => {
  if(data.type === "address"){
    console.log(data);
    yourAddress.textContent = data.data;
  } else {
    next();
  }
});


mewConnect.use((data, next) => {
  if(data.type === "sign"){
    try{
      let signed = JSON.parse(data.data);
      console.log(signed);
      signedMessage.textContent = data.data;
    } catch (e){
      console.error("RAW data:", data);
    }

  } else {
    next();
  }
});

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


// misc function
function logger(tag, err) {
  if(!err){
    console.log(tag);
  } else {
    console.log(tag, err)
  }

}