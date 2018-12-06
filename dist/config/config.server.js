'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var serverConfig = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 8080
};

exports.serverConfig = serverConfig;