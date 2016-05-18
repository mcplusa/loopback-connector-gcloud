var should = require('./init.js');
var util = require('util');
var assert = require('chai').assert;
var mocks = require('./mocks.js');
var db;

describe('When updating on the Loopback Connector for Gcloud', function() {
  before(function() {
    db = getDataSource();

    ACL = db.define('ACL', {
      property: { type: Object, index: true },
      accessType: { type: Object, index: true }
    });

    User = db.define('User', {
      name: { type: String, index: true },
      email: { type: String, index: true, unique: true },
      age: Number
    });
  });

  beforeEach(function () {
  });
  /*
  afterEach(function(done) {
    User.destroyAll(function(result) {
      ACL.destroyAll(function(result) {
        done();
      })
    });
  });
*/
    describe("when updating a user email", function() {

      it('should successfully change the email', function(done) {
        mocks.mockUpdate1UserEmail();
        var user1 = {
          name: "Juan Pablo",
          email: "jpdiazvaz@mcplusa.com",
          age: 25
        };
        User.create(user1, function(err, result) {
          assert.isNull(err, 'there was no error');
          assert.equal(result.name, user1.name);

          User.updateAll({where:{id: result.id}}, {email: 'jpdiazvaz@mcplusa.cl'}, function(err, result) {
            if(err) console.log("Error: %s",err);
            if(result) console.log("Result: %s",result);
            assert.equal(result[0].email, 'jpdiazvaz@mcplusa.cl');

            mocks.reset();
            done();
          });
        });
      });
    });

    describe("when updating multiple users ages", function() {

      it('should successfully change all ages', function(done) {

        var user1 = {
          name: "Juan Pablo",
          email: "jpdiazvaz@mcplusa.com",
          age: 25
        };
        var user2 = {
          name: "Michael Cizmar",
          email: "michaelcizmar@mcplusa.com",
          age: 25
        };

        mocks.mockUpdateMultipleUsers();
        User.create(user1, function(err, result) {
          assert.isNull(err, 'there was no error');
          assert.equal(result.name, user1.name);

          User.create(user2, function(err, result) {
            assert.isNull(err, 'there was no error');
            assert.equal(result.name, user2.name);

            User.updateAll({where:{age: 25}},{age: 26}, function(err, result) {
              assert.equal(result[0].age, '26');
              assert.equal(result[1].age, '26');

              mocks.reset();
              done();
            });
          });
        });
      });
    });
});
