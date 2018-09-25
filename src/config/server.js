require('dotenv').config({
  path: '../.env'
});
const server = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 8080
};

const redis = {
  host: process.env.DATA_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  timeout: process.env.REDIS_TIMOUT || 120
};

const socket = {
  serveClient: false
};

export {
  server,
  redis,
  socket
};
