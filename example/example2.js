"use strict";



const fs = require('fs');
const path = require('path')
const serverSig = require("../src/serverClass.js")

let key = fs.readFileSync(path.resolve(__dirname, "../sampleCerts/devCert.key"))
let cert = fs.readFileSync(path.resolve(__dirname, "../sampleCerts/devCert.cert"))



let serverOptions = {
  requestCert: false,
  rejectUnauthorized: false,
  key: key,
  cert: cert
}

let redisOptions = {
  host: process.env.DATA_REDIS_HOST,
  port: 6379,
  timeout: 10
}


let socketOptions = {
  serveClient: false,
  secure: true
}

const serverOne = serverSig.create({port: 3200, redis: redisOptions, server: serverOptions, socket: socketOptions});

const serverTwo = serverSig.create({port: 3300, redis: redisOptions, server: serverOptions, socket: socketOptions});
