import _ from './env'

import SignalServer from './serverClass';

SignalServer.create({
  socket: {
    pingInterval: 10000,
    pingTimeout: 5000
  }
});
