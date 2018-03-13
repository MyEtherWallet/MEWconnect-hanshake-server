// ========================== Receiver ========================================

/*
The remote side of the connection (e.g. phone).
Gets the key, and connection id created via calls from MewConnectInitiator to the server.
 */


class MewConnectReceiver extends MewConnectSimplePeer {
    constructor(uiCommunicatorFunc, loggingFunc, peerLib) {
        super(uiCommunicatorFunc, loggingFunc, peerLib);

        this.mewCrypto = new MewConnectCrypto();
    }

    async receiverCall(url, params) {
        console.log(params);
        this.mewCrypto.setPrivate(params.key);
        this.connId = params.connId;
        let options = {
            query: {
                peer: "peer2",
                connId: this.connId,
                stage: "receiver"
            },
            secure: true
        };
        console.log("options", options);
        this.socketManager = io(url, options);
        this.socket = this.socketManager.connect();

        this.socketOn('offer', this.receiveOffer.bind(this));
        this.socketOn("handshake", this.socketHandshake.bind(this));

        // this.socket.on('offer', this.receiveOffer.bind(this));
        // this.socket.on("handshake", this.socketHandshake.bind(this));
    }

    async socketHandshake(data) {
        this.signed = await this.mewCrypto.signMessage(data.toSign);
        this.uiCommunicator("signatureCheck", this.signed);
        this.socketEmit("signature", {signed: this.signed, connId: this.connId});
        // this.socket.emit("signature", {signed: this.signed, connId: this.connId})
    }

    onData(data) {
        console.log("DATA RECEIVED", data.toString());
        try {
            if(typeof data === "string"){
                let jData = JSON.parse(data);
                console.log("data as JSON:", jData);
                this.applyDatahandlers(jData);
            } else {
                if(data instanceof ArrayBuffer){
                    console.log("mewConnectReceiver:54 typeof data: ", typeof data); //todo remove dev item
                }

                let jData = JSON.parse(data.toString());
                console.log("data as JSON:", jData);
                this.applyDatahandlers(jData);
            }
        } catch (e) {
            console.error(e);

        }
    }

    onSignal(data) {
        this.logger("signal: ", JSON.stringify(data));
        let send = JSON.stringify(data);

        this.socketEmit('answerSignal', {data: send, connId: this.connId});
        // this.socket.emit('answerSignal', {data: send, connId: this.connId});
        this.uiCommunicator("RtcSignalEvent");
    }

    onConnect() {
        this.logger("CONNECTED");
        this.rtcSend({type: "text", data: "From Web"});
        // this.p.send('From Web');
        this.uiCommunicator("RtcConnectedEvent");
        this.socketEmit("rtcConnected", this.connId);
        // this.socket.emit("rtcConnected", this.connId);
        this.socketDisconnect();
    }

    onClose(data) {
        this.uiCommunicator("RtcClosedEvent");
    }

    onError(err) {
        this.logger("error: ", err, "error")
    }


    // sends a hardcoded message through the rtc connection
    testRTC(msg) {
        return function () {
            this.rtcSend(JSON.stringify({type: 2, text: msg}));
            // this.p.send(JSON.stringify({type: 2, text: msg}));
        }.bind(this);
    }

// sends a message through the rtc connection
    sendRtcMessage(type, msg) {
        return function () {
            console.log("peer 2 sendRtcMessage", msg);
            this.rtcSend(JSON.stringify({type: type, data: msg}));
            // this.p.send(JSON.stringify({type: type, data: msg}));
        }.bind(this);
    }

    // sends a message through the rtc connection
    sendRtcMessageResponse(type, msg) {
        console.log("peer 2 sendRtcMessage", msg);
        this.rtcSend(JSON.stringify({type: type, data: msg}));
        // this.p.send(JSON.stringify({type: type, data: msg}));
    }

    /*
    * Disconnect the current RTC connection
    */
    disconnectRTC() {
        return function () {
            this.uiCommunicator("RtcDisconnectEvent");
            this.rtcDestroy();
        }.bind(this);
    }

    socketEmit(signal, data){
        this.socket.emit(signal, data);
    }

    socketDisconnect(){
        this.socket.disconnect();
    }

    socketOn(signal, func){
        this.socket.on(signal, func);
    }
    // send the decoded address requested by the initiator peer
    sendAddress() {

    }




}

var isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]';

if (isNode) {
    module.exports = MewConnectReceiver;
}