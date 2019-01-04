'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  timeout: process.env.REDIS_TIMEOUT || 120,
  family: process.env.REDIS_FAMILY || 4,
  db: process.env.REDIS_DB || 0
};

exports.redisConfig = redisConfig;