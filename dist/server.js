'use strict';

// todo look into refactoring to accept plug-in testing data, and/or testing tools

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _logging = require('logging');

var _logging2 = _interopRequireDefault(_logging);

var _socket = require('socket.io-redis');

var _socket2 = _interopRequireDefault(_socket);

var _socket3 = require('socket.io');

var _socket4 = _interopRequireDefault(_socket3);

var _twilio = require('twilio');

var _twilio2 = _interopRequireDefault(_twilio);

var _validators = require('@/validators');

var _validators2 = _interopRequireDefault(_validators);

var _redisClient = require('@/redisClient');

var _redisClient2 = _interopRequireDefault(_redisClient);

var _config = require('@/config');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {

  var init = function init() {
    console.log('test');
  };

  return {
    init: init
  };
}();