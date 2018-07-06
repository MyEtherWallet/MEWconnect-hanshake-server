

const fs = require('fs');
const path = require('path');
const serverSig = require('../dist/serverClass.js');

const key = fs.readFileSync(path.resolve(__dirname, '../sampleCerts/devCert.key'));
const cert = fs.readFileSync(path.resolve(__dirname, '../sampleCerts/devCert.cert'));


const serverOptions = {
  requestCert: false,
  rejectUnauthorized: false,
  key,
  cert,
};

const redisOptions = {
  host: process.env.DATA_REDIS_HOST,
  port: 6379,
};

const socketOptions = {
  serveClient: false,
  secure: true,
};

const server = serverSig.create({
  port: 3200, redis: redisOptions, server: serverOptions, socket: socketOptions,
});

