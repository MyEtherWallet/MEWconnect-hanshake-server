'use strict';

require('module-alias/register');

var _server = require('@/server');

var _server2 = _interopRequireDefault(_server);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// See: https://www.npmjs.com/package/module-alias //
var server = new _server2.default();

server.init();