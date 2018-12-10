'use strict'

import SignalServer from '@clients/signal-server'

describe('Signal Server', () => {
  // Basic instantiation test //
  describe('Instantiation', () => {
    it('Should create a new SignalServer object with the correct properties', () => {
      const signalServer = new SignalServer()
      const expectedProperties = ['options', 'clients', 'host', 'port', 'server', 'redis', 'io']
      expect(Object.keys(signalServer)).toEqual(expect.arrayContaining(expectedProperties))
    })
  })
})
