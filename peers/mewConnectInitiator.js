// ========================== Initiator  ========================================
/*
* begins the sequence
* the connId is used as the socket confirm number and to identify the particular requester to
* match the two sides of the connection
*/

class MewConnectInitiator extends MewConnectCommon{

    constructor(uiCommunicatorFunc, loggingFunc) {
        super(uiCommunicatorFunc, loggingFunc);
        // this.uiCommunicatorFunc = uiCommunicatorFunc || function (arg1, arg2) {
        // };
        // this.logger = loggingFunc || function (arg1, arg2) {
        // };
        // this.middleware = [];

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

        socket.on("confirmation", this.sendOffer.bind(this)); // response
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
        });
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
        this.p = this.initiatorStartRTC(this.socket);
    }

    /*
  * begins the rtc connection and creates the offer and rtc confirm code
  * */
    initiatorStartRTC(socket, signalListener) {
        if (!signalListener) {
            signalListener = this.initiatorSignalListener(socket);
        }

        this.uiCommunicator("RtcInitiatedEvent");
        let p = new SimplePeer({initiator: true, trickle: false});
        this.p = p;
        p.on('error', this.onError.bind(this));
        p.on('connect', this.onConnect.bind(this));
        p.on('close', this.onClose.bind(this));
        p.on('data', this.onData.bind(this));
        p.on('signal', signalListener.bind(this));
        return p;
    }

    onError(err) {
        this.logger("error", err);
    }

    onConnect() {
        this.logger("CONNECT", "ok");
        this.p.send('From Mobile');
        this.uiCommunicator("RtcConnectedEvent");
        this.socket.emit("rtcConnected", this.socketKey);
        this.socket.disconnect();
    }

    onClose(data) {
        this.uiCommunicator("RtcClosedEvent", data);
    }

    onData(data) {
        console.log("DATA RECEIVED", data.toString());
        try {
            let jData = JSON.parse(data);
            this.applyDatahandlers(jData);
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
            socket.emit('offerSignal', {data: send, connId: this.connId});
        }
    }


    // sends a hardcoded message through the rtc connection
    testRTC(msg) {
        return function () {
            this.p.send(JSON.stringify({type: 2, text: msg}));
        }.bind(this);
    }

// sends a message through the rtc connection
    sendRtcMessage(type, msg) {
        console.log("peer 1 send rtc message", type, msg);
        return function () {
            //   console.log(stuff);
            console.log(msg);
            this.p.send(JSON.stringify({type: type, data: msg}));
        }.bind(this);
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


    /*
    * Used by the initiator to accept the rtc offer's answer
    */
    recieveAnswer(data) {
        this.p.signal(JSON.parse(data.data));
    }
    //
    // use(func) {
    //     this.middleware.push(func);
    // }
    //
    // useDataHandlers(input, fn) {
    //     var fns = this.middleware.slice(0);
    //     if (!fns.length) return fn(null);
    //
    //     function run(i) {
    //         fns[i](input, function (err) {
    //             // upon error, short-circuit
    //             if (err) return fn(err);
    //
    //             // if no middleware left, summon callback
    //             if (!fns[i + 1]) return fn(null);
    //
    //             // go on to next
    //             run(i + 1);
    //         });
    //     }
    //
    //     run(0);
    // }
    //
    // applyDatahandlers(data) {
    //     let next = function (args) {
    //         return args;
    //     }; // function that runs after all middleware
    //     this.useDataHandlers(data, next);
    // }
    //
    // /*
    // * allows external function to listen for lifecycle events
    // */
    // uiCommunicator(event, data) {
    //     return data ? this.uiCommunicatorFunc(event, data) : this.uiCommunicatorFunc(event);
    // }

}

var isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]';

if(isNode){
    module.exports = MewConnectInitiator;
}
