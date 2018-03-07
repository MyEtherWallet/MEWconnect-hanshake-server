"use strict";
const Buffer = require('safe-buffer').Buffer;
const crypto = require('crypto');
const secp256k1 = require('secp256k1');
const fs = require("fs");




module.exports.verifyKey = function (recPub, pvt) {
  console.log(recPub);
  console.log(generatePublic(pvt).toString("hex"));
  return recPub.toString("hex") == generatePublic(pvt).toString("hex");
}

module.exports.prepareKey = async function () {
  let prvt = await generatePrivate();
  let pub = await generatePublic(prvt);
  let result = await addKey(pub, prvt);
  return result;
};

function generatePrivate() {
  let privKey;
  do {
    privKey = crypto.randomBytes(32)
  } while (!secp256k1.privateKeyVerify(privKey));
  return privKey;
}


function generatePublic(privKey) {
  return secp256k1.publicKeyCreate(privKey);
}


function addKey(pub, pvt) {
  console.log({pub: pub, pvt: pvt});
  console.log("public as hex", pub.toString("hex"));
  return {pub: pub, pvt: pvt}
}