'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var signals = {
  attemptingTurn: 'attemptingTurn',
  turnToken: 'turnToken',
  tryTurn: 'tryTurn',
  connect: 'connect',
  connection: 'connection',
  signature: 'signature',
  offerSignal: 'offerSignal',
  offer: 'offer',
  answerSignal: 'answerSignal',
  answer: 'answer',
  initiated: 'initiated',
  rtcConnected: 'rtcConnected',
  rtcEstablished: 'rtcEstablished',
  disconnect: 'disconnect',
  handshake: 'handshake',
  confirmation: 'confirmation',
  socketTimeout: 'socketTimeout',
  invalidConnection: 'InvalidConnection',
  confirmationFailedBusy: 'confirmationFailedBusy',
  confirmationFailed: 'confirmationFailed'
};

var stages = {
  initiator: 'initiator',
  receiver: 'receiver'
};

var rtcSignals = {
  error: 'error',
  connect: 'connect',
  close: 'close',
  data: 'data',
  signal: 'signal'
};

exports.signals = signals;
exports.stages = stages;
exports.rtcSignals = rtcSignals;