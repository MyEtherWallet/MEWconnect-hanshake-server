

let p, send, socket, socketKey;

// ========================== Initiator Functions ========================================
/*
* begins the sequence
* the connId is used as the socket confirm number and to identify the particular requester to
* match the two sides of the connection
*/
function initiatorCall(url) {
  let socket = io.connect(url, {
    query: {
      connId: randomNumber()
    }
  });
  signalStateChange("SocketConnectedEvent");
  socket.on("answer", recieveAnswer);
  return socket;
}




/*
* begins the rtc connection and creates the offer and rtc confirm code
* */
function initiateRTC(socket, signalListener) {
  if(!signalListener) {
    signalListener = initiatorSignalListener(socket);
  }
  signalStateChange("RtcInitiatedEvent");
  p = new SimplePeer({initiator: true, trickle: false});

  p.on('error', function (err) {
    logger("error", err);
  });

  p.on('connect', function () {
    logger("CONNECT", "ok");
    p.send('From Mobile');
    signalStateChange("RtcConnectedEvent");
    socket.disconnect();
  });

  p.on('close', function (data) {
    signalStateChange("RtcClosedEvent");
  });

  p.on('data', function (data) {
    console.log("data", data);
    try{
      let jData = JSON.parse(data);
      // handleJData(jData);
    } catch(e){
      let recdData = data.toString();
      logger("peer1 data", recdData);
    }
  });

  p.on('signal', signalListener);

}

/*
* creates the confirm number and emits it along with the rtc confirm code to the server
*/

function initiatorSignalListener(socket){
  return function offerEmmiter(data){
    logger('SIGNAL', JSON.stringify(data));
    send = JSON.stringify(data);
    let random = randomNumber();
    console.log(random);
    socket.emit('offer', {data: send, confirm: random});
  }
}

/*
* Used by the initiator to accept the rtc offer's answer
*/
function recieveAnswer(data) {
  p.signal(JSON.parse(data.data));
}

// ========================== Receiver Functions ========================================
/*
* Initiates the socket connection between the receiver and the server
* The options argument is a query string consisting of the socket confirm code entered by the user
* that is used to match the two sides of the connection
*/
function receiverCall(url, options) {
  console.log("options", options);
  socket = io.connect(url, options);

  /*
  * triggers rtc setup
  * sent after receiver confirm code is checked to match*/
  socket.on('offer', receiveOffer);
}

/*
* Gets the confirm number entered by the user and sends it to the server
* If the verification fails the server responds with "confirmFail"
*/
function submitConfirm(value) {
  console.log(value);
  socket.emit("check", {data: value});
  socket.on("confirmFail", function(){
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
  p = new SimplePeer({initiator: false, trickle: false});
  p.signal(JSON.parse(data));

  p.on('error', function (err) {
    logger("error: ", err)
  });

  p.on('connect', function () {
    logger("CONNECTED");
    p.send('From Web');
    signalStateChange("RtcConnectedEvent");
    socket.disconnect();
  });

  p.on('data', function (data) {
    try{
      let jData = JSON.parse(data);
      // handleJData(jData);
    } catch(e){
      logger("peer2 data", data.toString());
    }

  });

  p.on('close', function (data) {
    signalStateChange("RtcClosedEvent");
  });

  p.on('signal', function (data){
    logger("signal: ", JSON.stringify(data));
    send = JSON.stringify(data);
    socket.emit('answer', {data: send});
    signalStateChange("RtcSignalEvent");
  });
}


// ========================== Common Functions ========================================
// sends a hardcoded message through the rtc connection
function testRTC(msg) {
  p.send(JSON.stringify({type: 2, text: msg}));
  // p.send(JSON.stringify({type: 2, text: "Sent Via RTC From Web Peer"}));
}

// sends a message through the rtc connection
function sendRtcMessage(msg) {
  console.log(msg);
  p.send(JSON.stringify({type: 1, text: msg}));
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


function randomNumber() {
  let random = Number.parseInt(((Math.random() * 1000).toString().slice(0, 4)), 10);
  signalStateChange("checkNumber", random.toString(10));
  return random;
}

