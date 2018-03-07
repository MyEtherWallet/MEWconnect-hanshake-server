


// ========================== Initiator  ========================================
/*
* begins the sequence
* the connId is used as the socket confirm number and to identify the particular requester to
* match the two sides of the connection
*/

class mewConnectInitiator{
  constructor(uiCommunicatorFunc, loggingFunc){

    this.uiCommunicatorFunc = uiCommunicatorFunc || function(arg1, arg2){};
    this.logger = loggingFunc || function(arg1, arg2){};
  }

  initiatorCall(url){
    let options = {query: {
        peer: "peer1",
      }};
    this.socketManager = io(url, options);
    this.socket = this.socketManager.connect();
    this.initiatorConnect(this.socket);
  }

  initiatorConnect(socket) {
    console.log("initiatorConnect", socket);
    this.uiCommunicator("SocketConnectedEvent");
    socket.on("handshake", this.displayCode.bind(this)); // first response after connection
    socket.on("confirmation", this.sendOffer.bind(this)); // response
    socket.on("answer", this.recieveAnswer.bind(this));
    socket.on("confirmationFailedBusy", ()=>{
      this.uiCommunicator("confirmationFailedEvent");
      this.logger("confirmation Failed: Busy");
    });
    socket.on("confirmationFailed", ()=>{
      this.uiCommunicator("confirmationFailedEvent");
      this.logger("confirmation Failed: invalid confirmation");
    });
    socket.on("InvalidConnection", ()=>{
      this.uiCommunicator("confirmationFailedEvent"); // should be different error message
      this.logger("confirmation Failed: no opposite peer found");
    });
    socket.on('disconnect', (reason) => {
      this.logger(reason);
    });
    return socket;
  }

  displayCode(data){
    this.logger("handshake", data);
    this.socketKey = data.connId;
    this.uiCommunicator("checkNumber", data.key);
  }

  sendOffer(data){
    this.logger("sendOffer", data);
    this.p = this.initiatorStartRTC(this.socket);
  }

  /*
* begins the rtc connection and creates the offer and rtc confirm code
* */
  initiatorStartRTC(socket, signalListener){
    if(!signalListener) {
      signalListener = this.initiatorSignalListener(socket);
    }

    this.uiCommunicator("RtcInitiatedEvent");
    let p = new SimplePeer({initiator: true, trickle: false});

    p.on('error', function (err) {
      this.logger("error", err);
    }.bind(this));

    p.on('connect', function () {
      this.logger("CONNECT", "ok");
      p.send('From Mobile');
      this.uiCommunicator("RtcConnectedEvent");
      socket.emit("rtcConnected", this.socketKey);
      socket.disconnect();
    }.bind(this));

    p.on('close', function (data) {
      this.uiCommunicator("RtcClosedEvent");
    }.bind(this));

    p.on('data', function (data) {
      this.logger("data", data);
      try{
        let jData = JSON.parse(data);
        // handleJData(jData);
      } catch(e){
        let recdData = data.toString();
        this.logger("peer1 data", recdData);
      }
    }.bind(this));

    p.on('signal', signalListener.bind(this));

    return p;
  }
  /*
  * creates the confirm number and emits it along with the rtc confirm code to the server
  */
  initiatorSignalListener(socket){
    return function offerEmmiter(data){
      this.logger('SIGNAL', JSON.stringify(data));
      let send = JSON.stringify(data);
      socket.emit('offerSignal', {data: send, connId: this.socketKey});
    }
  }

  // sends a hardcoded message through the rtc connection
  testRTC(msg) {
    return function(){
      this.p.send(JSON.stringify({type: 2, text: msg}));
    }.bind(this);
  }

// sends a message through the rtc connection
  sendRtcMessage(msg) {
    return function(){
      console.log(msg);
      this.p.send(JSON.stringify({type: 1, text: msg}));
    }.bind(this);
  }

  /*
  * Disconnect the current RTC connection
  */
  disconnectRTC() {
    return function(){
      this.uiCommunicator("RtcDisconnectEvent");
      this.p.destroy();
    }.bind(this);
  }
  /*
  * Used by the initiator to accept the rtc offer's answer
  */
  recieveAnswer(data) {
    this.p.signal(JSON.parse(data.data));
  }

  /*
  * allows external function to listen for lifecycle events
  */
  uiCommunicator(event, data){
    return data ? this.uiCommunicatorFunc(event, data) : this.uiCommunicatorFunc(event);
  }

}

// ========================== Receiver ========================================


class mewConnectReceiver{
  constructor(uiCommunicatorFunc, loggingFunc){
    // this.io = io;
    this.uiCommunicatorFunc = uiCommunicatorFunc || function(arg1, arg2){};
    this.logger = loggingFunc || function(arg1, arg2){};
  }

  receiverCall(url, connId) {
    let options = {query: {
        peer: "peer2",
        connId: connId
      }};
    this.socketKey = this.keyToConnId(connId);
    console.log("options", options);
    this.socketManager = io(url, options);
    this.socket = this.socketManager.connect();

    /*
    * triggers rtc setup
    * sent after receiver confirm code is checked to match*/
    this.socket.on('offer', this.receiveOffer.bind(this));
  }

  receiveOffer(data) {
    this.logger(data);
    let p = new SimplePeer({initiator: false, trickle: false});
    this.p = p;
    p.signal(JSON.parse(data.data));

    p.on('error', function (err) {
      this.logger("error: ", err)
    }.bind(this));

    p.on('connect', function () {
      this.logger("CONNECTED");
      p.send('From Web');
      this.uiCommunicator("RtcConnectedEvent");
      this.socket.emit("rtcConnected", this.socketKey);
      this.socket.disconnect();
    }.bind(this));

    p.on('data', function (data) {
      try{
        let jData = JSON.parse(data);
        // handleJData(jData);
      } catch(e){
        this.logger("peer2 data", data.toString());
      }

    }.bind(this));

    p.on('close', function (data) {
      this.uiCommunicator("RtcClosedEvent");
    }.bind(this));

    p.on('signal', function (data){
      this.logger("signal: ", JSON.stringify(data));
      let send = JSON.stringify(data);
      this.socket.emit('answerSignal', {data: send, connId: this.socketKey});
      this.uiCommunicator("RtcSignalEvent");
    }.bind(this));
  }

// sends a hardcoded message through the rtc connection
  testRTC(msg) {
    return function(){
      this.p.send(JSON.stringify({type: 2, text: msg}));
    }.bind(this);
  }

// sends a message through the rtc connection
  sendRtcMessage(msg) {
    return function(){
      console.log(msg);
      this.p.send(JSON.stringify({type: 1, text: msg}));
    }.bind(this);
  }

  /*
  * Disconnect the current RTC connection
  */
  disconnectRTC() {
    return function(){
      this.uiCommunicator("RtcDisconnectEvent");
      this.p.destroy();
    }.bind(this);
  }

  /*
* allows external function to listen for lifecycle events
*/
  uiCommunicator(event, data){
    return data ? this.uiCommunicatorFunc(event, data) : this.uiCommunicatorFunc(event);
  }

  // extracts portion of key used as the connection id
  keyToConnId(key){
    return key.slice(32);
  }

}



