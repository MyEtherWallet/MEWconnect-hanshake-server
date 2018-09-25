import chai from 'chai';

const assert = chai.assert;

describe('usingRedis.test.js', function() {
  const RedisClient = require('../src/redisClient');
  let redis, connId;
  before(function() {
    connId = '123';
    redis = new RedisClient();
  });

  after(function() {
    redis.disconnect();
  });

  // test cases
  it('Add single entry', function(done) {
    let details = {
      connId: connId,
      message: '',
      signed: 'sdfsdfsdfsdfsdf',
      pub: '',
      initiator: 'abcde',
      receiver: undefined,
      requireTurn: false,
      tryTurnSignalCount: 0
    };

    redis.createConnectionEntry(details, 'abcde')
      .then(result => {
        console.log('createConnectionEntry', result); // todo remove dev item
        done();
      });
  });

  it('Get single entry ', function(done) {
    redis.getConnectionEntry('123')
      .then(result => {
        console.log('getConnectionEntry', result); // todo remove dev item
        done();
      });
  });

  it('verifies a supplied verification signature', function(done) {
    let sig = 'sdfsdfsdfsdfsdf';
    redis.verifySig(connId, sig)
      .then(result => {
        console.log('verifySig', result); // todo remove dev item
        done();
      });
  });

  it('Update single entry ', function(done) {
    redis.updateConnectionEntry(connId, 'wxyz')
      .then(result => {
        console.log('updateConnectionEntry', result); // todo remove dev item
        done();
      })
      .catch(error => {
        console.error(error); // todo replace with proper error
      });
  });

  it('Update turn state entry ', function(done) {
    redis.updateTurnStatus(connId)
      .then(result => {
        console.log('updateTurnStatus', result); // todo remove dev item
        redis.getConnectionEntry(connId)
          .then(_result => {
            console.log(_result);
            done();
          });
      })
      .catch(error => {
        console.error(error); // todo replace with proper error
      });
  });

  it('Removes a single entry ', function(done) {
    redis.removeConnectionEntry(connId)
      .then(result => {
        console.log('removeConnectionEntry', result); // todo remove dev item
        done();
      })
      .catch(error => {
        console.error(error); // todo replace with proper error
      });
  });
});
