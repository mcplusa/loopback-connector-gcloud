var should = require('./init.js');
var util = require('util');
var assert = require('chai').assert;
var mocks = require('./mocks.js');
var db;

describe('When using the Loopback Connector for Gcloud', function() {
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

  afterEach(function(done) {
    User.destroyAll(function(result) {
      ACL.destroyAll(function(result) {
        done();
      })
    });
  });

  ///// DB TESTS /////
  describe('when doing a Ping', function() {

    it('should return no error', function(done) {
      mocks.mockLogin();
      mocks.mockFindEmpty();
      db.ping(function(error, result) {
        assert.isNull(error);

        mocks.reset();
        done();
      });
    });

  });

  ///// ACL TESTS /////
  describe('when filtering a non-existent Kind', function() {

    it('should return an empty set', function(done) {
      var propertyFilter = {where: {and: [
          {
              "name": "property",
              "op": "=",
              "val": {
                  "inq": [
                      "login",
                      "*"
                  ]
              }
          },
          {
              "name": "accessType",
              "op": "=",
              "val": {
                  "inq": [
                      "EXECUTE",
                      "*"
                  ]
              }
          }
        ]}};

      mocks.mockLogin();
      mocks.mockFindEmpty();
      ACL.find(propertyFilter,function(err, result) {
        assert.isUndefined(err, 'there was no error');
        assert.lengthOf(result, 0, 'Empty result set');

        mocks.reset();
        done();
      });
    });

  });
  ///// USER TESTS /////
    describe("when creating a new entity", function() {

      it('should create it and then return the inserted entity', function(done) {
        var user1 = {
          name: "Juan Pablo",
          email: "jpdiazvaz@mcplusa.com",
          age: 25
        };

        mocks.mockLogin();
        mocks.mockLogin();
        mocks.mockCreateSuccess();
        mocks.mockFindUser1();
        User.create(user1, function(err, result) {
          assert.isNull(err, 'there was no error');

          User.findById(result.id, function(err, result) {
            assert.isUndefined(err, 'there was no error');

            assert.equal(result.name, user1.name, "user name got added correctly");
            assert.equal(result.email, user1.email, "user email got added correctly");
            assert.equal(result.age, user1.age, "user age got added correctly");

            mocks.reset();
            done();
          });
        });
      });

    });

    describe("when creating multiple entities", function() {

      it('should successfully create all of them and return them', function(done) {
        var user1 = {
          name: "Juan Pablo",
          email: "jpdiazvaz@mcplusa.com",
          age: 25
        };
        var user2 = {
          name: "Michael Cizmar",
          email: "michaelcizmar@mcplusa.com",
          age: 24
        };

        mocks.mockLogin();
        mocks.mockLogin();
        mocks.mockLogin();
        mocks.mockCreateSuccess();
        mocks.mockCreateSuccess();
        User.create(user1, function(err, result) {
          assert.isNull(err, 'there was no error');
          assert.equal(result.name, user1.name);

          User.create(user2, function(err, result) {
            assert.isNull(err, 'there was no error');
            assert.equal(result.name, user2.name);

            mocks.reset();
            done();
          });
        });
      });
    });

    describe("when deleting one user", function() {
      it('should not return it back when fetching all users', function(done) {
        var user1 = {
          name: "Juan Pablo",
          email: "jpdiazvaz@mcplusa.com",
          age: 25
        };
        var id;

        mocks.mockLogin();
        mocks.mockCreateSuccess();
        mocks.mockFindUsersToDelete();
        mocks.mockDestroyUser1();
        mocks.mockFindUsersAfterDestroy();
        User.create(user1, function(err, result) {
          assert.isNull(err, 'there was no error');
          assert.equal(result.name, user1.name);
          id = result.id;

          User.find({where:{id: id}}, function(err, result) {
            assert.isUndefined(err, 'there was no error');
            assert.lengthOf(result, 1, 'User return');

            User.destroyAll({id: id},function(err, result) {
              assert.isNull(err, 'there was no error');

              User.find({where:{id: id}},function(err, result) {
                assert.isUndefined(err, 'there was no error');
                assert.lengthOf(result, 0, 'Empty result set');

                mocks.reset();
                done();
              });
            });
          });
        });
      });
    });

    describe("when finding one group of ages or other", function() {
        it('should return both groups', function(done) {
            mocks.mockFilterByAgeOrClause();

            User.create([
                {
                    name: 'Juan Pablo Diaz-Vaz',
                    email: 'jpdiazvaz@mcplusa.com',
                    age: 25
                },
                {
                    name: 'Sebastian Espinosa',
                    email: 'sespinosa@mcplusa.com',
                    age: 25
                },
                {
                    name: 'Michael Cizmar',
                    email: 'michaelcizmar@mcplusa.com',
                    age: 27
                },
                {
                    name: 'Walter Paredes',
                    email: 'walter.paredes@mcplusa.com',
                    age: 26
                }
            ], function (err, results) {
                assert.isNull(err, 'there was no error');
                User.find({where: {or: [{age: 25}, {age: 27}]}}, function(err, results) {
                    assert.isUndefined(err, 'there was no error');

                    assert.lengthOf(results, 3, '3 Users comply with the filter');

                    done();
                });
            });
        });
    });

});
