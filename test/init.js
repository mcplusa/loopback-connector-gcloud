module.exports = require('should');

var DataSource = require('loopback-datasource-juggler').DataSource;

var nock = require('nock');
nock.recorder.rec({dont_print:true,output_objects: false});

var TEST_ENV = process.env.TEST_ENV || 'test';
var config = require('rc')('loopback', {test: {gcloud: {}}})[TEST_ENV].gcloud;

config = {
  projectId: '<YOUR_PROJECT_ID>',
  keyFilename: '<YOUR_JSON_KEY_PATH>'
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
