'use strict'

const signal = {
  attemptingTurn: 'attemptingTurn',
  turnToken: 'turnToken',
  tryTurn: 'tryTurn',
  connection: 'connection',
  signature: 'signature',
  offerSignal: 'offerSignal',
  offer: 'offer',
  answerSignal: 'answerSignal',
  answer: 'answer',
  rtcConnected: 'rtcConnected',
  disconnect: 'disconnect',
  handshake: 'handshake',
  confirmation: 'confirmation',
  socketTimeout: 'socketTimeout',
  invalidConnection: 'InvalidConnection',
  confirmationFailedBusy: 'confirmationFailedBusy',
  confirmationFailed: 'confirmationFailed'
}

const stages = {
  initiator: 'initiator',
  receiver: 'receiver'
}

export {
  signal,
  stages
}
