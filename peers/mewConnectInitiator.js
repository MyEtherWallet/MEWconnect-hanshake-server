// ========================== Initiator  ========================================
/*
* begins the sequence
* the connId is used as the socket confirm number and to identify the particular requester to
* match the two sides of the connection
*/

class MewConnectInitiator extends MewConnectSimplePeer{

    constructor(uiCommunicatorFunc, loggingFunc, peerLib) {
        super(uiCommunicatorFunc, loggingFunc, peerLib);

        this.mewCrypto = new MewConnectCrypto();
        console.log(this.mewCrypto);
    }


    initiatorCall(url) {
        this.keys = this.mewCrypto.prepareKey();
        let toSign = this.mewCrypto.generateMessage();
        this.signed = this.mewCrypto.signMessage(toSign);
        this.connId = this.mewCrypto.bufferToConnId(this.keys.pub);
        console.log("this.connId", this.connId);
        this.signed.then(response => {
            console.log(this.keys);
            console.log(response);
            console.log("this.connId", this.connId);
            this.displayCode(this.keys.pvt.toString("hex"));
            this.uiCommunicator("signatureCheck", response);
            let options = {
                query: {
                    peer: "peer1",
                    stage: "initiator",
                    signed: response,
                    message: toSign,
                    connId: this.connId
                },
                transports: ['websocket', 'polling', 'flashsocket'],
                secure: true
            };
            this.socketManager = io(url, options);
            this.socket = this.socketManager.connect();
            this.initiatorConnect(this.socket);
        })
    }

    initiatorConnect(socket) {
        console.log("initiatorConnect", socket);
        this.uiCommunicator("SocketConnectedEvent");

        this.socketOn("confirmation", this.sendOffer.bind(this)); // response
        this.socketOn("answer", this.recieveAnswer.bind(this));
        this.socketOn("confirmationFailedBusy", () => {
            this.uiCommunicator("confirmationFailedEvent");
            this.logger("confirmation Failed: Busy");
        });
        this.socketOn("confirmationFailed", () => {
            this.uiCommunicator("confirmationFailedEvent");
            this.logger("confirmation Failed: invalid confirmation");
        });
        this.socketOn("InvalidConnection", () => {
            this.uiCommunicator("confirmationFailedEvent"); // should be different error message
            this.logger("confirmation Failed: no opposite peer found");
        });
        this.socketOn('disconnect', (reason) => {
            this.logger(reason);
        });

/*        socket.on("confirmation", this.sendOffer.bind(this)); // response
        socket.on("answer", this.recieveAnswer.bind(this));
        socket.on("confirmationFailedBusy", () => {
            this.uiCommunicator("confirmationFailedEvent");
            this.logger("confirmation Failed: Busy");
        });
        socket.on("confirmationFailed", () => {
            this.uiCommunicator("confirmationFailedEvent");
            this.logger("confirmation Failed: invalid confirmation");
        });
        socket.on("InvalidConnection", () => {
            this.uiCommunicator("confirmationFailedEvent"); // should be different error message
            this.logger("confirmation Failed: no opposite peer found");
        });
        socket.on('disconnect', (reason) => {
            this.logger(reason);
        });*/
        return socket;
    }

    displayCode(data) {
        this.logger("handshake", data);
        this.socketKey = data;
        let qrCodeString = data + "-" + this.connId;
        this.uiCommunicator("codeDisplay", qrCodeString);
        this.uiCommunicator("checkNumber", data);
        this.uiCommunicator("ConnectionId", this.connId);
    }

    sendOffer(data) {
        this.logger("sendOffer", data);
        this.initiatorStartRTC(this.socket);
    }


    onError(err) {
        this.logger("error", err);
    }

    onConnect() {
        this.logger("CONNECT", "ok");
        // this.p.send('From Mobile');
        this.rtcSend({type: "text", data: "From Mobile"});
        this.uiCommunicator("RtcConnectedEvent");
        this.socketEmit("rtcConnected", this.socketKey);
        this.socketDisconnect();

        // this.socket.emit("rtcConnected", this.socketKey);
        // this.socket.disconnect();
    }

    onClose(data) {
        this.uiCommunicator("RtcClosedEvent", data);
    }

    onData(data) {
        console.log("DATA RECEIVED", data.toString());
        try {
            if(typeof data === "string"){
                let jData = JSON.parse(data);
                console.log("data as JSON:", jData);
                this.applyDatahandlers(jData);
            } else {
                this.applyDatahandlers(data);
            }
        } catch (e) {
            console.error(e);
            this.logger("peer2 data", data.toString());
            this.applyDatahandlers(data);
        }
    }

    /*
    * creates the confirm number and emits it along with the rtc confirm code to the server
    */
    initiatorSignalListener(socket) {
        return function offerEmmiter(data) {
            this.logger('SIGNAL', JSON.stringify(data));
            let send = JSON.stringify(data);
            this.socketEmit('offerSignal', {data: send, connId: this.connId});
            // socket.emit('offerSignal', {data: send, connId: this.connId});
        }
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
        console.log("peer 1 send rtc message", type, msg);
        return function () {
            //   console.log(stuff);
            console.log(msg);
            this.rtcSend(JSON.stringify({type: type, text: msg}));
            // this.p.send(JSON.stringify({type: type, data: msg}));
        }.bind(this);
    }

    /*
    * Disconnect the current RTC connection
    */
    disconnectRTC() {
        return function () {
            this.uiCommunicator("RtcDisconnectEvent");
            this.rtcDestroy();
            // this.p.destroy();
        }.bind(this);
    }


    /*
    * Used by the initiator to accept the rtc offer's answer
    */
    recieveAnswer(data) {
        this.rtcRecieveAnswer(data);
        // this.p.signal(JSON.parse(data.data));
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


}

var isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]';

if(isNode){
    module.exports = MewConnectInitiator;
}
