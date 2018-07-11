'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var signal = {
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
};

var stages = {
  initiator: 'initiator',
  receiver: 'receiver'
};
var loggerLevels = {
  errorLvl: 'error',
  warnLvl: 'warn',
  infoLvl: 'info',
  verboseLvl: 'verbose',
  debugLvl: 'debug',
  sillyLvl: 'silly'
};

exports.signal = signal;
exports.stages = stages;
exports.loggerLevels = loggerLevels;