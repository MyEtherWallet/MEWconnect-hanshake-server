class MewConnectPeer extends MewConnectCommon {
    constructor(uiCommunicatorFunc, loggingFunc, peerLib) {
        super(uiCommunicatorFunc, loggingFunc);

        this.peer = peerLib;
        window.onunload = window.onbeforeunload = function(e) {
            if (!!this.peer && !this.peer.destroyed) {
                this.rtcDestroy();
            }
        };
    }

// METHODS EXTENDING CLASSES MUST OVERRIDE
    receiveOffer(data) {
        console.error("NOT IMPLEMENTED");
    }

    /*
* begins the rtc connection and creates the offer and rtc confirm code
* */
    initiatorStartRTC(socket, signalListener) {
        console.error("NOT IMPLEMENTED");
    }


    /*
    * Used by the initiator to accept the rtc offer's answer
    */
    rtcRecieveAnswer(data) {
        console.error("NOT IMPLEMENTED");
    }

    rtcSend(arg) {
        console.error("NOT IMPLEMENTED");
    }

    rtcDestroy() {
        console.error("NOT IMPLEMENTED");
    }

    /*
    * creates the confirm number and emits it along with the rtc confirm code to the server
    */
    initiatorSignalListener(socket) {
        return function offerEmmiter(data) {
            console.error("NOT IMPLEMENTED");
        }
    }

    onData(data) {
        console.error("NOT IMPLEMENTED");
    }

    onSignal(data) {
        console.error("NOT IMPLEMENTED");
    }

    onConnect() {
        console.error("NOT IMPLEMENTED");
    }

    onClose(data) {
        console.error("NOT IMPLEMENTED");
    }

    onError(err) {
        console.error("NOT IMPLEMENTED");
    }

}