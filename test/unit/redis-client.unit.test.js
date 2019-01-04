'use strict'

import _ from 'lodash'
import Redis from 'ioredis'
import RedisClient from '@clients/redis-client'
import CryptoUtils from '@utils/crypto-utils'
import { redisConfig } from '@config'

/*
===================================================================================
  Test "Member Variables"
===================================================================================
*/

const redisClient = new RedisClient()

// Key Variables //
let publicKey
let privateKey
let connId
let message
let signed
let socketId

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
  socketId = CryptoUtils.generateRandomMessage()
  console.log(socketId)
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
        const expectedProperties = [
          'options',
          'connectionErrorCounter'
        ]
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
      3a. Methods -> createConnectionEntry
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
        3a. Methods -> createConnectionEntry -> FAIL
      ===================================================================================
      */
      describe('<FAIL>', () => {
        it('Should not be successful with missing @details.connId property', async () => {
          let details = _.cloneDeep(detailsObject)
          delete details.connId

          let result = await redisClient.createConnectionEntry(details, socketId)
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @details.message property', async () => {
          let details = _.cloneDeep(detailsObject)
          delete details.message

          let result = await redisClient.createConnectionEntry(details, socketId)
          expect(result).toBe(false)
        })
        it('Should not be successful with missing @details.signed property', async () => {
          let details = _.cloneDeep(detailsObject)
          delete details.signed

          let result = await redisClient.createConnectionEntry(details, socketId)
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
        3a. Methods -> createConnectionEntry -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully create a Redis entry', async () => {
          let details = _.cloneDeep(detailsObject)

          let result = await redisClient.createConnectionEntry(details, socketId)
          expect(result).toBe(true)
        })
      })
    })

    /*
    ===================================================================================
      3b. Methods -> locateMatchingConnection
    ===================================================================================
    */
    describe('locateMatchingConnection', () => {
      /*
      ===================================================================================
        3a. Methods -> createConnectionEntry -> FAIL
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
        3a. Methods -> createConnectionEntry -> SUCCESS
      ===================================================================================
      */
      describe('<SUCCESS>', () => {
        it('Should successfully find a matching connection', async () => {
          let result = await redisClient.locateMatchingConnection(connId)
          expect(result).toBe(true)
        })
      })
    })
  })
})
