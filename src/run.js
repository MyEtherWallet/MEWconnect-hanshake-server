// See: https://www.npmjs.com/package/module-alias //
import 'module-alias/register'

import Server from '@/server'

const server = new Server()

server.init()
