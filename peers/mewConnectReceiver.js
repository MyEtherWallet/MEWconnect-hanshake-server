// ========================== Receiver ========================================

/*
The remote side of the connection (e.g. phone).
Gets the key, and connection id created via calls from MewConnectInitiator to the server.
 */


class MewConnectReceiver extends MewConnectCommon {
    constructor(uiCommunicatorFunc, loggingFunc, peerLib) {
        super(uiCommunicatorFunc, loggingFunc);
        console.log(peerLib);
        // this.io = io;
        // this.uiCommunicatorFunc = uiCommunicatorFunc || function (arg1, arg2) {
        // };
        // this.logger = loggingFunc || function (arg1, arg2) {
        // };
        // this.middleware = [];

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

        this.socket.on('offer', this.receiveOffer.bind(this));
        this.socket.on("handshake", this.socketHandshake.bind(this))
    }

    receiveOffer(data) {
        this.logger(data);
        let simpleOptions = {
            initiator: false,
            trickle: false,
            reconnectTimer: 100,
            iceTransportPolicy: 'relay',
        };
        let p = new SimplePeer(simpleOptions);
        this.p = p;
        p.signal(JSON.parse(data.data));
        p.on('error', this.onError.bind(this));
        p.on('connect', this.onConnect.bind(this));
        p.on('data', this.onData.bind(this));
        p.on('close', this.onClose.bind(this));
        p.on('signal', this.onSignal.bind(this));
    }

    async socketHandshake(data) {
        this.signed = await this.mewCrypto.signMessage(data.toSign);
        this.uiCommunicator("signatureCheck", this.signed);
        this.socket.emit("signature", {signed: this.signed, connId: this.connId})
    }

    onData(data) {
        console.log("DATA RECEIVED", data.toString());
        try {
            let jData = JSON.parse(data.toString());
            console.log("data as JSON:", jData);
            this.applyDatahandlers(jData);
        } catch (e) {
            console.error(e);
            this.applyDatahandlers(data);
        }
    }

    onSignal(data) {
        this.logger("signal: ", JSON.stringify(data));
        let send = JSON.stringify(data);
        this.socket.emit('answerSignal', {data: send, connId: this.connId});
        this.uiCommunicator("RtcSignalEvent");
    }

    onConnect() {
        this.logger("CONNECTED");
        this.p.send('From Web');
        this.uiCommunicator("RtcConnectedEvent");
        this.socket.emit("rtcConnected", this.connId);
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
        return function () {
            this.p.send(JSON.stringify({type: 2, text: msg}));
        }.bind(this);
    }

// sends a message through the rtc connection
    sendRtcMessage(type, msg) {
        return function () {
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
        return function () {
            this.uiCommunicator("RtcDisconnectEvent");
            this.p.destroy();
        }.bind(this);
    }


    // send the decoded address requested by the initiator peer
    sendAddress() {

    }




}

var isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]';

if (isNode) {
    module.exports = MewConnectReceiver;
}