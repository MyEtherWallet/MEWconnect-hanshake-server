'use strict';

require('module-alias/register');

var _server = require('@/server');

var _server2 = _interopRequireDefault(_server);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import SignalServer from './serverClass';

// SignalServer.create();
//
// See: https://www.npmjs.com/package/module-alias //
_server2.default.init();