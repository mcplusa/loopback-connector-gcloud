module.exports = require('should');

var DataSource = require('loopback-datasource-juggler').DataSource;

var TEST_ENV = process.env.TEST_ENV || 'test';
var config = require('rc')('loopback', {test: {gcloud: {}}})[TEST_ENV].gcloud;

config = {
  projectId: 'fakeProject',
  keyFilename: '<keyfile>',
  email: '<email>'
};

global.config = config;

global.getDataSource = global.getSchema = function (customConfig) {
  var db = new DataSource(require('../'), config);
  db.log = function (a) {
    console.log(a);
  };

  return db;
};

global.sinon = require('sinon');
