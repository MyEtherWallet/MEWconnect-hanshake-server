'use strict';

// See: https://www.npmjs.com/package/module-alias //

require('module-alias/register');

var _signalServer = require('@/clients/signal-server');

var _signalServer2 = _interopRequireDefault(_signalServer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var server = new _signalServer2.default();
server.init();