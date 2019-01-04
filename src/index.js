'use strict'

// See: https://www.npmjs.com/package/module-alias //
import 'module-alias/register'
import dotenv from 'dotenv'
import Server from '@clients/signal-server'

const server = new Server()
server.init()
