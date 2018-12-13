'use strict'

import crypto from 'crypto'
import eccrypto from 'eccrypto'
import ethUtils from 'ethereumjs-util'
import secp256k1 from 'secp256k1'

export default (() => {
  /**
   * Generate a public/private keypair using secp256k1
   * @return {Object} - publicKey/privateKey object
   */
  const generateKeys = () => {
    let privateKey = Buffer.from(crypto.randomBytes(32), 'hex')
    let publicKey = secp256k1.publicKeyCreate(privateKey)
    return {
      publicKey,
      privateKey
    }
  }

  /**
   * Generate a connId using given a public key
   * @param  {String} publicKey - publicKey string (usually generated with generateKeys())
   * @return {String} - connId string
   */
  const generateConnId = (publicKey) => {
    return publicKey.toString('hex').slice(32)
  }

  /**
   * Generate a random message of 32 bytes
   * @return {String} - The randomly generated string
   */
  const generateRandomMessage = () => {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Sign a message using a privateKey
   * @param  {String} msg - Message to sign/hash
   * @param  {[type]} privateKey - Private key (usually generated with generateKeys())
   * @return {String} - Signed message
   */
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

  const encrypt = async (data, privateKey) => {
    let publicKey = eccrypto.getPublic(privateKey)
    return new Promise((resolve, reject) => {
      eccrypto
        .encrypt(publicKey, Buffer.from(data))
        .then(encryptedData => {
          resolve(encryptedData)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  return {
    generateKeys,
    generateConnId,
    generateRandomMessage,
    signMessage,
    encrypt
  }
})()
