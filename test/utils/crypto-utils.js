'use strict'

import crypto from 'crypto'
import eccrypto from 'eccrypto'
import ethUtils from 'ethereumjs-util'
import secp256k1 from 'secp256k1'

export default (() => {

  // let privateKey
  // let publicKey
  // let connId

  const generateKeys = () => {
    let privateKey = Buffer.from(crypto.randomBytes(32), 'hex')
    let publicKey = secp256k1.publicKeyCreate(privateKey)
    return {
      publicKey,
      privateKey
    }
  }

  const generateConnId = (publicKey) => {
    return publicKey.toString('hex').slice(32)
  }

  const generateRandomMessage = () => {
    return crypto.randomBytes(32).toString('hex')
  }

  const signMessage = (msg, privateKey) => {
    let hashedMsg = ethUtils.hashPersonalMessage(ethUtils.toBuffer(msg))
    let signed = ethUtils.ecsign(
      Buffer.from(hashedMsg),
      Buffer.from(privateKey, 'hex')
    )
    let combined = Buffer.concat([
      Buffer.from([signed.v]),
      Buffer.from(signed.r),
      Buffer.from(signed.s)
    ])
    let combinedHex = combined.toString('hex')
    return combinedHex
  }

  return {
    generateKeys,
    generateConnId,
    generateRandomMessage,
    signMessage
  }
})()
