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


let socketOptions = {
  serveClient: false,
  secure: true
}

const server = serverSig.create({port: 3200, server: serverOptions, socket: socketOptions});
