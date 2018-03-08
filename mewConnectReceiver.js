// ========================== Receiver ========================================

/*
The remote side of the connection (e.g. phone).
Gets the key, and connection id created via calls from MewConnectInitiator to the server.
 */


class MewConnectReceiver{
  constructor(uiCommunicatorFunc, loggingFunc){
    // this.io = io;
    this.uiCommunicatorFunc = uiCommunicatorFunc || function(arg1, arg2){};
    this.logger = loggingFunc || function(arg1, arg2){};
    this.middleware = [];
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

    p.on('error', this.onError.bind(this));
    p.on('connect', this.onConnect.bind(this));
    p.on('data', this.onData.bind(this));
    p.on('close', this.onClose.bind(this));
    p.on('signal', this.onSignal.bind(this));
  }


  onData(data) {
    console.log("DATA RECEIVED", data.toString());
    try{
      console.log("type:", typeof data);
      let jData = JSON.parse(data.toString());
      console.log("data as JSON:", jData);
      this.applyDatahandlers(jData);
    } catch(e){
      console.error(e);
      this.logger("peer2 data", data, "error");
      this.applyDatahandlers(data);
    }
  }

  onSignal(data){
    this.logger("signal: ", JSON.stringify(data));
    let send = JSON.stringify(data);
    this.socket.emit('answerSignal', {data: send, connId: this.socketKey});
    this.uiCommunicator("RtcSignalEvent");
  }

  onConnect() {
    this.logger("CONNECTED");
    this.p.send('From Web');
    this.uiCommunicator("RtcConnectedEvent");
    this.socket.emit("rtcConnected", this.socketKey);
    this.socket.disconnect();
  }

  onClose(data) {
    this.uiCommunicator("RtcClosedEvent");
  }

  onError(err) {
    this.logger("error: ", err, "error")
  }


  // sends a hardcoded message through the rtc connection
  testRTC(msg) {
    return function(){
      this.p.send(JSON.stringify({type: 2, text: msg}));
    }.bind(this);
  }

// sends a message through the rtc connection
  sendRtcMessage(type, msg) {
    return function(){
      console.log("peer 2 sendRtcMessage", msg);
      this.p.send(JSON.stringify({type: type, data: msg}));
    }.bind(this);
  }

  // sends a message through the rtc connection
  sendRtcMessageResponse(type, msg) {
      console.log("peer 2 sendRtcMessage", msg);
      this.p.send(JSON.stringify({type: type, data: msg}));
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



  // send the decoded address requested by the initiator peer
  sendAddress(){

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

  use(func){
    this.middleware.push(func);
  }

  useDataHandlers(input, fn){
    var fns = this.middleware.slice(0);
    if (!fns.length) return fn(null);

    function run(i){
      fns[i](input, function(err){
        // upon error, short-circuit
        if (err) return fn(err);

        // if no middleware left, summon callback
        if (!fns[i + 1]) return fn(null);

        // go on to next
        run(i + 1);
      });
    }
    run(0);
  }

  applyDatahandlers(data){
    let next = function(args){return args;}; // function that runs after all middleware
    this.useDataHandlers(data, next);
  }


}

if(!window) {
  module.exports = mewConnectReceiver;
}