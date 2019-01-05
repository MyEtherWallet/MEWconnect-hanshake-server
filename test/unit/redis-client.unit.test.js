'use strict'

// Imports //
import _ from 'lodash'
import Redis from 'ioredis'

// Libs //
import RedisClient from '@clients/redis-client'
import CryptoUtils from '@utils/crypto-utils'
import { redisConfig } from '@config'

/*
===================================================================================
  Test "Member Variables"
===================================================================================
*/

// Instantiate RedisClient instance //
const redisClient = new RedisClient()

// Key Variables //
let publicKey
let privateKey
let connId
let message
let signed
let socketIdInitiator
let socketIdReceiver

/*
===================================================================================
  Test Initialization
===================================================================================
*/

/**
 * Before all tests, generate keys used across test suite.
 */
beforeAll(async done => {
  let keys = CryptoUtils.generateKeys()
  publicKey = keys.publicKey
  privateKey = keys.privateKey
  connId = CryptoUtils.generateConnId(publicKey)
  message = CryptoUtils.generateRandomMessage()
  signed = CryptoUtils.signMessage(privateKey, privateKey)
  socketIdInitiator = CryptoUtils.generateRandomMessage()
  socketIdReceiver = CryptoUtils.generateRandomMessage()
  done()
})

/*
===================================================================================
  Test Start
===================================================================================
*/

describe('Redis Client', () => {
  /*
  ===================================================================================
    1. Instantiation
  ===================================================================================
  */
  describe('Instantiation', () => {
    describe('<SUCCESS>', () => {
      it('Should create a new RedisClient object with the correct properties', () => {
        const expectedProperties = ['options', 'connectionErrorCounter']
        expect(Object.keys(redisClient)).toEqual(
          expect.arrayContaining(expectedProperties)
        )
      })
    })
  })

  /*
  ===================================================================================
    2. Initialization
  ===================================================================================
  */
  describe('Initialization', () => {
    describe('<SUCCESS>', () => {
      it('Should properly initialize', async () => {
        await redisClient.init()

        // Redis Client //
        let client = redisClient.client
        expect(client instanceof Redis).toBe(true)

        // Redis instance config options //
        let config = client.connector.options
        expect(config.host).toEqual(redisConfig.host)
        expect(config.port).toEqual(redisConfig.port)
        expect(config.family).toEqual(redisConfig.family)
        expect(config.db).toEqual(redisConfig.db)
      })
    })
  })

  /*
  ===================================================================================
    3. Methods
  ===================================================================================
  */
  describe('Methods', () => {
    /*
    ===================================================================================
      3. Methods -> createConnectionEntry
    ===================================================================================
    */
    describe('createConnectionEntry', () => {
      let detailsObject

      beforeAll(() => {
        detailsObject = {
          connId: connId,
          message: message,
          signed: signed
        }
      })

      /*
      ===================================================================================
        3. Methods -> createConnectionEntry -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with missing @details.connId property', async () => {
          let details = _.cloneDeep(detailsObject)
          delete details.connId
          let result = await redisClient.createConnectionEntry(
            details,
            socketIdInitiator
          )
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @details.message property', async () => {
          let details = _.cloneDeep(detailsObject)
          delete details.message
          let result = await redisClient.createConnectionEntry(
            details,
            socketIdInitiator
          )
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @details.signed property', async () => {
          let details = _.cloneDeep(detailsObject)
          delete details.signed
          let result = await redisClient.createConnectionEntry(
            details,
            socketIdInitiator
          )
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @socketId property', async () => {
          let details = _.cloneDeep(detailsObject)
          let result = await redisClient.createConnectionEntry(details)
          expect(result).toBe(false)
        })
      })

      /*
      ===================================================================================
        3. Methods -> createConnectionEntry -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully create a Redis entry', async () => {
          let details = _.cloneDeep(detailsObject)
          let result = await redisClient.createConnectionEntry(
            details,
            socketIdInitiator
          )
          expect(result).toBe(true)
        })
      })
    })

    /*
    ===================================================================================
      3. Methods -> locateMatchingConnection
    ===================================================================================
    */
    describe('locateMatchingConnection', () => {
      /*
      ===================================================================================
        3. Methods -> locateMatchingConnection -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with missing @connId property', async () => {
          let invalidConnId = CryptoUtils.generateRandomMessage()
          let result = await redisClient.locateMatchingConnection(invalidConnId)
          expect(result).toBe(false)
        })
        it('Should not be successful locating an incorrect @connId property', async () => {
          let result = await redisClient.locateMatchingConnection()
          expect(result).toBe(false)
        })
      })

      /*
      ===================================================================================
        3. Methods -> locateMatchingConnection -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully find a matching connection', async () => {
          let result = await redisClient.locateMatchingConnection(connId)
          expect(result).toBe(true)
        })
      })
    })

    /*
    ===================================================================================
      3. Methods -> getConnectionEntry
    ===================================================================================
    */
    describe('getConnectionEntry', () => {
      /*
      ===================================================================================
        3. Methods -> getConnectionEntry -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with missing @connId property', async () => {
          let invalidConnId = CryptoUtils.generateRandomMessage()
          let result = await redisClient.getConnectionEntry(invalidConnId)
          expect(Object.keys(result).length).toBe(0)
        })
        it('Should not be successful locating an incorrect @connId property', async () => {
          let result = await redisClient.getConnectionEntry()
          expect(Object.keys(result).length).toBe(0)
        })
      })

      /*
      ===================================================================================
        3. Methods -> getConnectionEntry -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully return Redis entry created with createConnectionEntry()', async () => {
          let result = await redisClient.getConnectionEntry(connId)
          expect(result.message).toBe(message)
          expect(result.initiator).toBe(socketIdInitiator)
          expect(result.initialSigned).toBe(signed)
        })
      })
    })

    /*
    ===================================================================================
      3. Methods -> updateConnectionEntry
    ===================================================================================
    */
    describe('updateConnectionEntry', () => {
      /*
      ===================================================================================
        3. Methods -> updateConnectionEntry -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with incorrect @connId property', async () => {
          let invalidConnId = CryptoUtils.generateRandomMessage()
          let result = await redisClient.updateConnectionEntry(
            invalidConnId,
            socketIdReceiver
          )
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @socketId property', async () => {
          let result = await redisClient.updateConnectionEntry(connId)
          expect(result).toBe(false)
        })
      })

      /*
      ===================================================================================
        3. Methods -> updateConnectionEntry -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully update the Redis entry', async () => {
          let result = await redisClient.updateConnectionEntry(
            connId,
            socketIdReceiver
          )
          expect(result).toBe(true)

          let entry = await redisClient.getConnectionEntry(connId)
          expect(entry.receiver).toBe(socketIdReceiver)
        })
      })
    })

    /*
    ===================================================================================
      3. Methods -> verifySig
    ===================================================================================
    */
    describe('verifySig', () => {
      /*
      ===================================================================================
        3. Methods -> verifySig -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with incorrect @connId property', async () => {
          let invalidConnId = CryptoUtils.generateRandomMessage()
          let result = await redisClient.verifySig(invalidConnId, signed)
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @sig property', async () => {
          let result = await redisClient.verifySig(connId)
          expect(result).toBe(false)
        })
        it('Should not be successful with incorrect @sig property', async () => {
          let invalidSig = CryptoUtils.generateRandomMessage()
          let result = await redisClient.verifySig(connId, invalidSig)
          expect(result).toBe(false)
        })
      })

      /*
      ===================================================================================
        3. Methods -> verifySig -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully verify correct signature', async () => {
          let result = await redisClient.verifySig(connId, signed)
          expect(result).toBe(true)
        })
      })
    })

    /*
    ===================================================================================
      3. Methods -> removeConnectionEntry
    ===================================================================================
    */
    describe('removeConnectionEntry', () => {
      /*
      ===================================================================================
        3. Methods -> removeConnectionEntry -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with missing @connId property', async () => {
          let result = await redisClient.removeConnectionEntry()
          expect(result).toBe(false)
        })
        it('Should not be successful with incorrect @connId property', async () => {
          let invalidConnId = CryptoUtils.generateRandomMessage()
          let result = await redisClient.removeConnectionEntry(invalidConnId)
          expect(result).toBe(false)
        })
      })

      /*
      ===================================================================================
        3. Methods -> removeConnectionEntry -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully remove Redis entry', async () => {
          let result = await redisClient.removeConnectionEntry(connId)
          expect(result).toBe(true)

          let entry = await redisClient.getConnectionEntry(connId)
          expect(Object.keys(entry).length).toBe(0)
        })
      })
    })
  })
})
