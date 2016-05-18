var _ = require('lodash');
var assert = require('assert');
var util = require('util');
var async = require('async');

// Require the google cloud connector
var gcloud = require('gcloud');

// Require the base Connector class
var Connector = require('loopback-connector').Connector;

// Require the debug module with a pattern of loopback:connector:connectorName
var debug = require('debug')('loopback:connector:gcloud-datastore');

/**
 * Initialize the  connector against the given data source
 *
 * @param {DataSource} dataSource The loopback-datasource-juggler dataSource
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initializeDataSource(dataSource, callback) {
    dataSource.connector = new GcloudDataStoreConnector(dataSource.settings);

    if (callback) {
        callback();
    }
};

/**
 * Define the basic connector
 */
function GcloudDataStoreConnector(settings) {
    // Call the super constructor with name and settings
    Connector.call(this, 'gcloud-datastore', settings);

    // Store properties
    this.datastore = gcloud.datastore({
        projectId: settings.projectId,
        keyFilename: settings.keyFilename || undefined,
        email: settings.email || undefined,
        namespace: settings.namespace || undefined
    });
}

// Set up the prototype inheritence
util.inherits(GcloudDataStoreConnector, Connector);

GcloudDataStoreConnector.prototype.relational = false;

GcloudDataStoreConnector.prototype.getTypes = function() {
    return ['db', 'nosql', 'gcloud-datastore'];
};

GcloudDataStoreConnector.prototype.connect = function(callback) {
    if (callback) {
        callback();
    }
};

GcloudDataStoreConnector.prototype.disconnect = function(callback) {
    if (callback) {
        callback();
    }
};

GcloudDataStoreConnector.prototype.destroy = function(model, id, callback) {
    var ds = this.dataset;
    var key = ds.key([model, id]);
    ds.delete(key, function(err) {
      if (callback) {
          if(err) return callback(err);

          callback(null);
      }
    });
};

GcloudDataStoreConnector.prototype.toDatabaseData = function(model, data) {
    var definition = this.getModelDefinition(model);
    var properties = definition.properties;

    return _.map(data, function(data, name) {
        var property = properties[name];
        var excluded = property ? property.index === false : true;

        return {
            name: name,
            value: data,
            excludeFromIndexes: excluded
        };
    });
};

GcloudDataStoreConnector.prototype.all = function(model, filter, callback) {
    this.find(model, filter, callback);
};

GcloudDataStoreConnector.prototype.find = function(model, filter, callback) {
    debug('find: %s %s', model, JSON.stringify(filter));

    // Setup
    var idName = this.idName(model);
    var ds = this.datastore;
    var query = ds.createQuery(model);
    var self = this;

    // Define the filter support
    var filterClause = function(data, name) {
        // Sanity check
        data = data === undefined || data === null ? "" : data;

        // How to handle?
        if (idName == name) {
            var key;

            if(typeof data == 'string' && !isNaN(data)){
              key = ds.key([model, parseInt(data)]);
            }
            else {
              key = ds.key([model, data]);
            }

            debug('find: adding filter __key__ = %s , that came from model: %s and data: %s', JSON.stringify(key), model, data);
            query.filter('__key__', key);
        } else if ('and' === name) {
            _.each(data, function(where) {
                _.each(where, filterClause);
            });
        } else {
            debug('find: adding filter %s = %s', name, JSON.stringify(data));
            if (typeof data == "number") {
              query.filter(name, parseInt(data));
            } else {
              query.filter(name, data.toString());
            }
        }
    };

    // Handle request for OR clause
    if (filter.where && filter.where.hasOwnProperty('or')) {
        var subORQueryResults = [];
        var data = filter.where.or;
        debug('find: or clause conditions:', JSON.stringify(data));
        async.forEach(data, function(filter, callback) {
            self.find(model, {where: filter}, function(err, results) {
                debug('find: Return OR query: %s', JSON.stringify(results));
                if (!err) Array.prototype.push.apply(subORQueryResults, results);
                callback();
            });
        }, function(err) {
            debug('find: Finished executing subqueries, returning: %s', JSON.stringify(subORQueryResults));
            callback(null, subORQueryResults);
        })
    } else {
        // Where clauses (including filtering on primary key)
        _.each(filter.where, filterClause);

        // If main where clause wasn't an OR, execute query
        debug('find: Query does not contain OR, executing: %s',JSON.stringify(query));
        // Limit, Offset restrictions
        if (undefined === filter.limit) {
          filter.limit = 100000000
        }
        debug('find: adding limit %d', filter.limit);
        query = query.limit(filter.limit);

        if (undefined !== filter.offset) {
            debug('find: adding offset %d', filter.offset);
            query = query.offset(filter.offset);
        }

        debug('find: execute %s', JSON.stringify(query));

        // Run the query
        ds.runQuery(query, function (errors, result, cursor) {
            debug('find: results %s', JSON.stringify(errors || result));

            if (callback === null || callback === undefined) {
                return;
            }

            if (errors) {
                return callback(errors);
            }

            // Done
            callback(null, _.map(result, function (entity) {
                entity.data[idName] = entity.key.path[1];
                return entity.data;
            }));
        });
    }
};

GcloudDataStoreConnector.prototype.findById = function(model, id, callback) {
    debug('findById:', model, id);

    var idName = this.idName(model);
    var filters = {
        where: {},
        limit: 1
    };

    filters.where[idName] = id;

    return _.first(this.find(model, filters, callback));
};

GcloudDataStoreConnector.prototype.create = function(model, data, options, callback) {
    debug('create: %s %s %s', model, JSON.stringify(data), JSON.stringify(options));
    assert(data, 'Cannot save an empty entity into the database');

    // Setup
    var idName = this.idName(model);
    var id = data[idName];
    var ds = this.datastore;
    var key, definition;

    // Is there already an ID set for insert?
    if (id) {
        debug('create: using preset: %s %s', idName, id);
        key = ds.key([model, id]);
    } else {
        debug('create: no ID found on %s, will be auto-generated on insert', idName);
        key = ds.key(model);
    }

    // Exclude invalid properties if the model is defined as strict
    definition = this.getModelDefinition(model);

    if (definition.strict === true) {
        data = _.pick(data, _.keys(definition.properties));
    }

    // Convert to a proper DB format, with indexes off as needed
    //data = this.toDatabaseData(model, data);

    // Update the data
    debug('create: execute %s', JSON.stringify({key: key, data: data}));

    ds.save({
        key: key,
        data: data
    }, function(errors, result) {
        debug('create: result %s', JSON.stringify(errors || result));

        if (callback === null || callback === undefined) {
            return;
        }

        if (errors) {
            return callback(errors);
        }

        if (!key.path) {
            return callback('Internal error: missing key.path');
        }

        if (!key.path[1]) {
            return callback('Internal error: missing key.path[1]');
        }

        // Done
        callback(null, key.path[1]);
    });
};

GcloudDataStoreConnector.prototype.updateAttributes = function(model, id, data, options, callback) {
    debug('updateAttributes: %s %s %s %s', model, id, JSON.stringify(data), JSON.stringify(options));
    assert(id, 'Cannot update an entity without an existing ID');

    // For future reference
    var idName = this.idName(model);
    var ds = this.datastore;
    var key = ds.key([model, parseInt(id)]);
    var definition = this.getModelDefinition(model);
    var self = this;

    // Find the existing data
    debug('updateAttributes: fetching pre-existing data first...');

    this.findById(model, id, function(errors, original) {
        if (errors) {
            return callback(errors, null);
        }

        // Exclude invalid properties
        if (definition.strict === true) {
            data = _.pick(data, _.keys(definition.properties));
        }

        // Merge in new data over the old data
        data = _.merge(original[0], data);

        // Delete the entityId from the incoming data if present
        data = _.omit(data, idName);

        // Convert to a proper DB format, with indexes off as needed
        data = self.toDatabaseData(model, data);

        // Showcase
        debug('updateAttributes: execute %s', JSON.stringify(data));

        // Update the data
        ds.update({
            key: key,
            data: data
        }, function(errors, result) {
            debug('updateAttributes: result %s', JSON.stringify(errors || result));

            if (callback === null || callback === undefined) {
                return;
            }

            if (errors) {
                return callback(errors);
            }

            // Done
            callback(null, id);
        });
    });
};

GcloudDataStoreConnector.prototype.update =
GcloudDataStoreConnector.prototype.updateAll = function(model, where, data, options, callback) {
  debug('updateAll: %s %s %s', model, JSON.stringify(where), JSON.stringify(data));

  var idName = this.idName(model);
  var ds = this.datastore;
  var self = this;

  // Find filtered objects keys
  self.find(model, where, function(err, entities) {
    debug('updateAll: Updating this entities: %s', JSON.stringify(entities));

    var updatedEntities = [];
    var updatedEntitiesResult = [];

    _.each(entities, function(entity) {
      var key = ds.key([model, parseInt(entity[idName])]);

      var updatedEntity = {
        key: key
      };
      updatedEntity.data = _.merge(entity, data);
      updatedEntitiesResult.push(updatedEntity.data);
      updatedEntity.data = _.omit(updatedEntity.data, idName);

      updatedEntities.push(updatedEntity);
    });

    ds.update(updatedEntities, function(err, result) {
      if (!err) {
        callback(err, updatedEntitiesResult);
      } else {
        callback(err, result);
      }
    });
  });
};

/**
 * Delete all matching model instances
 *
 * https://googlecloudplatform.github.io/gcloud-node/#/docs/v0.15.0/datastore/dataset?method=delete
 *
 * @param {String} model The model name
 * @param {Object} where The where object
 * @param {Object} options The options object
 * @param {Function} callback The callback function
 */
GcloudDataStoreConnector.prototype.destroyAll = function(model, where, options, callback) {
    debug('destroyAll: %s %s %s', model, JSON.stringify(where), JSON.stringify(options));

    // Setup
    var idName = this.idName(model);
    var id = where[idName];
    var ds = this.datastore;
    var key = ds.key([model, parseInt(id)]);

    where = where || {};
    options = options || {};

    var runDelete = function(key){
      ds.delete(key, function(errors, result) {
        debug('destroyAll: result %s', JSON.stringify(errors || result));

        if (!callback) {
          return;
        }

        if (errors) {

          return callback(errors);
        }

        // Done
        callback(null, null);
      });
    };

    if(Object.keys(where).length == 0 && Object.keys(options).length == 0) {
      key = ds.createQuery(model);
      var query = ds.createQuery(model).select(['__key__']);
      ds.runQuery(query, function(err, res){
        if(err) { return callback(err); }
        keys = res.map(function(a) {return a.key;});
        runDelete(keys);
      });
    }
    else {
      runDelete(key);
    }

    // Update the data
    debug('destroyAll: execute %s', JSON.stringify(key));

};

/**
 * Count all the records in the dataset that match.
 *
 * Since (in loopback) this method is called with an explicity where clause that
 * restricts the search to a single record by ID, the result of this call will only
 * ever be a 0 (not found) or a 1 (found).
 *
 * @param {String} model The model name
 * @param {Object} where The where clause
 * @param {Object} options The options object
 * @param {Function} callback The callback function
 * @return {Number} The total size of the result set found.
 */
GcloudDataStoreConnector.prototype.count = function(model, where, options, callback) {
    debug('count: %s %s %s', model, JSON.stringify(where), JSON.stringify(options));

    // Setup
    var idName = this.idName(model);

    // Redirect
    debug('count: redirecting to find...');

    return this.find(model, {
        where: where
    }, function(errors, result) {
        debug('count: result %s', JSON.stringify(errors || result));

        if (callback === null || callback === undefined) {
            return;
        }

        if (errors) {
            return callback(errors);
        }

        // Done
        callback(errors, Number(_.size(result || [])));
    });
};

GcloudDataStoreConnector.prototype.ping = function(cb) {
    debug('ping');

    var ds = this.datastore;
    var query = ds.createQuery('dummy');

    ds.runQuery(query, function(err, entities, nextQuery, response) {
      cb(err, response);
    });
};
