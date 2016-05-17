var should = require('./init.js');
var util = require('util');
var assert = require('chai').assert;
var mocks = require('./mocks.js');
var db;

//var nock = require('nock');
//nock.recorder.rec({dont_print:false, output_objects: false});

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

  afterEach(function() {
  });

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

        result.destroy(function(err) {
          assert.isNull(err, 'there was no error');

          mocks.reset();
          done();
        });

      });
    });
  });

});
