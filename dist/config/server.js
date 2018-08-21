'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
require('dotenv').config({
  path: '../.env'
});
var server = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 8080
};

var redis = {
  host: process.env.DATA_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  timeout: process.env.REDIS_TIMOUT || 120
};

var socket = {
  serveClient: false
  // secure: true
};

exports.server = server;
exports.redis = redis;
exports.socket = socket;

// const server = serverSig.create({
//   port: 3200, redis: redisOptions, server: serverOptions, socket: socketOptions
// })