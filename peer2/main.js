"use strict";
//==================================================================
// DEV USER VARIABLES

let devWallet = {
  privateKey: "cc8cdea919c19781a971b4c290d27dec25d503b611abff7b725051e220cab5f6",
  publicKey: "0xa285efbee9bd70e1f595b880b00e112a9c7d126370e31e297833c76fa77c8fc2d4fe5087be7803e38c81f4e05c78e6c70323586fb77cf57189b544d8756949dd",
  password: "123456789",

  V3: {
    "version": 3,
    "id": "dd9e92fa-17d6-4449-a7d6-488109deb5b2",
    "address": "a842d06bb63912e6062b6be8d7095e603bc58b9d",
    "Crypto": {
      "ciphertext": "2867d6310ef4146bbf79f5c138be7d8595d270265ee2993dc344555050bcade4",
      "cipherparams": {"iv": "f744630c7fdbf7647a161c55b8e01ff7"},
      "cipher": "aes-128-ctr",
      "kdf": "scrypt",
      "kdfparams": {
        "dklen": 32,
        "salt": "ffbd991f8d317d4a6ec687f7b7f5f4b5c2374a5e8bb197283b1291ef1e1aebf7",
        "n": 8192,
        "r": 8,
        "p": 1
      },
      "mac": "b760ad4cebb72504f207669c3353d671886b6ed177778f0c137891e19aaf8e73"
    }
  }
};

let v2Signed = {
  "address": "0xa842d06bb63912e6062b6be8d7095e603bc58b9d",
  "msg": "signMessage",
  "sig": "0xf1168923b0f014cd5b41b4bbe2039f2f69bd88c4009d38700422749a308ea7057c842e81caf039edc22c8ffd4e4dd36bfdbbc018b1dd8ccf451e6c99be056b001b",
  "version": "3",
  "signer": "MEW"
}
function getDevWallet() {
  return devWallet;
}

//==================================================================

let mewConnect = new MewConnectReceiver(signalStateChange, logger);

let connectionState = document.getElementById("connState");
let disconnectBtn = document.getElementById("disconnect");
let confirmNumber = document.getElementById("confirmNumber");
let submit = document.getElementById("submitConfirm");
// let begin = document.getElementById("begin");
let socketKeyBtn = document.getElementById("socketKeyBtn");
let sendRtcMessageBtn = document.getElementById("sendRtcMessage");
// let socket;

disconnectBtn.disabled = true;
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
    mewConnect.receiverCall("ws://localhost:3001", document.getElementById("socketKey").value);
  });



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


let testRTCBtn = document.getElementById("testRTC");
testRTCBtn
  .addEventListener("click", mewConnect.testRTC());


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
  sendRtcMessageBtn.disabled = true;
  socketKeyBtn.disabled = false;
}

function rtcSignalButtonState(evt){
  disconnectBtn.disabled = false;
  submit.disabled = true;
  socketKeyBtn.disabled = true;
}

function disconnectRtcButtonState(){
  document.getElementById("socketKey").value = '';
  confirmNumber.value = '';
  disconnectBtn.disabled = true;
}

function confirmedState(){
  connectionState.textContent = "Confirmation Failed";
}


//============================== Message Middleware ========================

let addType = "address";
let addResp = "user address";
let msgType = "sign";
let msgResp = "Signed Message";

mewConnect.use((data, next) => {
  if(data.type === "address"){
    // let cred = getDevWallet();
    let address = getAddress(devWallet.privateKey);
    // console.log("Receiver found address:", address);
    mewConnect.sendRtcMessageResponse(addType, address);
    // console.log("GET ADDRESS:", data);
    // console.log("RESPONSE", addType, addResp);
  } else {
    next();
  }
});


mewConnect.use((data, next) => {
  if(data.type === "sign"){
    // console.log("SIGN MESSAGE:", data);
    // console.log("RESPONSE", msgType, msgResp);
    signMessage(data.msg, devWallet.privateKey)
      .then(signedmessage => {
        mewConnect.sendRtcMessageResponse(msgType, signedmessage);
      })
      .catch(err => {
        console.error(err);
      })
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
function logger(tag, err, type) {
  if(type){
    if(type === "error"){
      if(!err){
        console.error(tag);
      } else {
        console.error(tag, err)
      }
    }
  } else {
    if(!err){
      console.info(tag);
    } else {
      console.info(tag, err)
    }
  }

}