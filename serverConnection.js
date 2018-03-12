class ServerConnection {
    constructor(details) {
        console.log("ServerConnection", details);
        this.connId = details.connId;
        this.message = details.message;
        this.initialSigned = details.signed;
        this.pub = details.pub;
        this.initiator = details.initiator;
        this.receiver = details.receiver || undefined;
    }


    updateConnectionEntry(socketId) {
        try {
            console.log("updateConnectionEntry");
            // ensure only one connection pair exists.  Cause any additional/further attempts to fail.
            if (this.receiver) {
                return false;
            } else {
                // update connection entry with socket id of receiver connection
                this.receiver = socketId;
                // clients.set(connEntry.connId, connEntry);
                return true;
            }
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    verifySig(receiver) {
        return this.initialSigned === receiver;
    };

}


var isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]';

if (isNode) {
    module.exports = ServerConnection;
}