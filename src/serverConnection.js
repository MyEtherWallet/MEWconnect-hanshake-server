class ServerConnection {
  constructor(details) {
    // console.log('ServerConnection', details); // todo remove dev item
    this.connId = details.connId;
    this.message = details.message;
    this.initialSigned = details.signed;
    this.pub = details.pub;
    this.initiator = details.initiator;
    this.receiver = details.receiver || undefined;
    this.requireTurn = false;
    this.tryTurnSignalCount = 0;
  }

  updateConnectionEntry(socketId) {
    try {
      // console.log('updateConnectionEntry'); // todo remove dev item
      // ensure only one connection pair exists.  Cause any additional/further attempts to fail.
      if (this.receiver) {
        return false;
      }
      // update connection entry with socket id of receiver connection
      this.receiver = socketId;
      // clients.set(connEntry.connId, connEntry);
      return true;
    } catch (e) {
      console.error(e); // todo remove dev item
      return false;
    }
  }

  updateTurnStatus() {
    this.tryTurnSignalCount = this.tryTurnSignalCount + 1;
    this.requireTurn = true;
  }

  attemptTurn() {
    return !this.requireTurn;
  }

  connectionFailure() {
    return this.tryTurnSignalCount <= 2;
  }

  verifySig(receiver) {
    return this.initialSigned === receiver;
  }
}

module.exports = ServerConnection;
