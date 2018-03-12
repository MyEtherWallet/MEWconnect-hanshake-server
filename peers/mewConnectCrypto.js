class MewConnectCrypto {
    constructor() {
        this.crypto = CCrypto.crypto;
        this.secp256k1 = CCrypto.secp256k1;
        this.ethUtil = EthUtilities;
        // this.buffer = CCrypto.Buffer;
    }

    setPrivate(pvtKey){
        this.prvt = new CCrypto.Buffer(pvtKey, "hex");
    }

    generateMessage(){
        return this.crypto.randomBytes(32).toString("hex");
    }

    prepareKey() {
        this.prvt = this.generatePrivate();
        this.pub = this.generatePublic(this.prvt);
        let result = this.addKey(this.pub, this.prvt);
        return result;
    };

    generatePrivate() {
        let privKey;
        do {
            privKey = this.crypto.randomBytes(32)
        } while (!this.secp256k1.privateKeyVerify(privKey));
        return privKey;
    }


    generatePublic(privKey) {
        let pvt = new CCrypto.Buffer(privKey, "hex");
        this.prvt = pvt;
        return this.secp256k1.publicKeyCreate(pvt);
    }


    async signMessage(msgToSign){
        console.log(msgToSign);
        // let msgBuffer = new CCrypto.Buffer(msg);
        let msg = await this.ethUtil.hashPersonalMessage(this.ethUtil.toBuffer(msgToSign));
        console.log(msg.buffer);
        let signed = await this.ethUtil.ecsign(msg, new CCrypto.Buffer(this.prvt, "hex"));
        var combined = await CCrypto.Buffer.concat([CCrypto.Buffer.from(signed.r), CCrypto.Buffer.from(signed.s), CCrypto.Buffer.from([signed.v])]);
        let combinedHex = combined.toString("hex");
        console.log(msg);
        console.log(combinedHex);
        return combinedHex;
    }


    addKey(pub, pvt) {
        console.log({pub: pub, pvt: pvt});
        console.log("public as hex", pub.toString("hex"));
        return {pub: pub, pvt: pvt}
    }

    bufferToConnId(buf) {
        return buf.toString("hex").slice(32);
    }

}


var isNode = typeof global !== "undefined" && ({}).toString.call(global) === '[object global]';

if(isNode){
    module.exports = MewConnectCrypto;
}
