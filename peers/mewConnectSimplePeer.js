class MewConnectSimplePeer extends MewConnectPeer {
    constructor(uiCommunicatorFunc, loggingFunc, peerLib) {
        super(uiCommunicatorFunc, loggingFunc, peerLib);

        this.peer = peerLib;
    }


    receiveOffer(data) {
        this.logger(data);
        let simpleOptions = {
            initiator: false,
            trickle: false,
            reconnectTimer: 100,
            iceTransportPolicy: 'relay',
        };
        let p = new this.peer(simpleOptions);
        this.p = p;
        p.signal(JSON.parse(data.data));
        p.on('error', this.onError.bind(this));
        p.on('connect', this.onConnect.bind(this));
        p.on('data', this.onData.bind(this));
        p.on('close', this.onClose.bind(this));
        p.on('signal', this.onSignal.bind(this));
    }

    /*
* begins the rtc connection and creates the offer and rtc confirm code
* */
    initiatorStartRTC(socket, signalListener) {
        if (!signalListener) {
            signalListener = this.initiatorSignalListener(socket);
        }

        this.uiCommunicator("RtcInitiatedEvent");
        let p = new this.peer({initiator: true, trickle: false});
        this.p = p;
        p.on('error', this.onError.bind(this));
        p.on('connect', this.onConnect.bind(this));
        p.on('close', this.onClose.bind(this));
        p.on('data', this.onData.bind(this));
        p.on('signal', signalListener.bind(this));
        return p;
    }


    /*
    * Used by the initiator to accept the rtc offer's answer
    */
    rtcRecieveAnswer(data) {
        this.p.signal(JSON.parse(data.data));
    }

    rtcSend(arg) {
        if(typeof arg === "string"){
            this.p.send(arg);
        } else {
            this.p.send(JSON.stringify(arg));
        }

    }

    rtcDestroy() {
        this.p.destroy();
    }
}