/**
 * A custom cache thing
 *
 * Need a cache that will hand out stale results
 * until new results are ready.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const _ = require('lodash');
const nodeCache = require('node-cache');
const moment = require('moment-timezone');
const debug = require('debug')('cache');


// Cache object
function Cache(options) {
  this.options = _.extend({}, {
    expire: 30 * 1000,
    prefix: 'cache-'
  }, options);

  // Set up cache
  if (this.options.redis) {
    this.redis = this.options.redis;
  }
  else {
    this.cache = new nodeCache();
  }

  // Setup place for timeouts
  this.timeouts = {};
}

// Methods
_.extend(Cache.prototype, {
  // Set cache data
  set: function(key, value, expire, isItem) {
    var pKey = this.options.prefix + key;
    var item;

    // Set expire to millisecond timestamp
    expire = expire || this.options.expire;
    expire = parseInt(moment().format('x')) + expire;

    // Handle type of value
    if (isItem) {
      item = value;
    }
    else {
      item = {
        value: value,
        stale: false,
        refreshing: false,
        expire: expire
      };
    }

    // Set
    if (this.redis) {
      this.redis.hset(pKey, 'value', JSON.stringify(item.value));
      this.redis.hset(pKey, 'stale', JSON.stringify(item.stale));
      this.redis.hset(pKey, 'refreshing', JSON.stringify(item.stale));
      this.redis.hset(pKey, 'expire', JSON.stringify(item.expire));
    }
    else {
      this.cache.set(pKey, item);
    }
  },

  // Get data from cache.
  get: function(key, noMark, done) {
    var pKey = this.options.prefix + key;
    var now = parseInt(moment().format('x'));
    var thisCache = this;
    var item;

    if (_.isFunction(noMark)) {
      done = noMark;
      noMark = false;
    }
    done = done || _.noop;

    // Mark stale or needs refresh
    function mark(item) {
      if (noMark) {
        return item;
      }

      if (item) {
        // Check if stale
        if (!item.stale) {
          if (item.expire < now) {
            debug('Expiring: ' + key);
            item.stale = true;
            thisCache.expire(key);
          }
        }

        // Mark as need refresh
        item.shouldRefresh = false;
        if (item.stale && !item.refreshing) {
          item.shouldRefresh = true;
        }
      }

      return item;
    }

    // Get
    if (this.redis) {
      this.redis.hgetall(pKey, function(error, item) {
        if (error) {
          debug('Error getting cache from redis [' + pKey + ']: ', e);
          return done(error);
        }

        if (item) {
          _.each(item, function(i, ii) {
            item[ii] = JSON.parse(i);
          });
        }
        item = item ? item : undefined;
        done(null, mark(item));
      });
    }
    else {
      item = mark(this.cache.get(pKey));
      done(null, item);
      return item;
    }
  },

  // Expire cache data.  Mark as expired but don't remove.
  expire: function(key) {
    this.updateProp(key, 'stale', true);
  },

  // Update property for cache item
  updateProp: function(key, prop, value) {
    var item;
    var pKey = this.options.prefix + key;

    if (this.redis) {
      this.redis.hset(pKey, prop, value);
    }
    else {
      item = this.get(key, true);
      if (item) {
        item[prop] = value;
        this.set(key, item, false, true);
      }
    }
  },

  // Mark as refreshing
  refreshing: function(key) {
    this.updateProp(key, 'refreshing', true);
  },

  // Mark as not refreshing (for failed refresh attempts)
  doneRefreshing: function(key) {
    this.updateProp(key, 'refreshing', false);
  },

  // Remove item from cache
  remove: function(key) {
    var pKey = this.options.prefix + key;

    if (this.redis) {
      this.redis.del(pKey);
    }
    else {
      this.cache.del(pKey);
    }
  },

  // Middleware function
  middleware: function(options) {
    var thisCache = this;
    options = _.extend({}, this.options, options);

    return function(req, res, next) {
      // Determine key and get data
      var key = _.isFunction(options.key) ? options.key(req, res) : req.originalUrl;
      debug('Requesting cache: ' + key);

      thisCache.get(key, function(error, item) {
        if (error) {
          return next(error);
        }

        // Determine whether to use cache not
        if (!item || (item && !item.value) || (item && item.shouldRefresh)) {
          debug('No or stale cache: ' + key);

          if (item && item.shouldRefresh) {
            debug('Start refreshing cache: ' + key);
            thisCache.refreshing(key);
          }

          // Handle original data coming through and caching
          function handleData(data) {
            var set = false;
            data = data.toJSON ? data.toJSON() : data;

            // Make sure good value.  If bad, mark as not refreshing so it can
            // be tried again.
            if (res.statusCode !== 200 || (_.isObject(data) && data.status === 'error')) {
              debug('Response error: ' + key);
              debug(res.statusCode);
              debug(data);
              thisCache.doneRefreshing(key);
            }
            else {
              debug('Cache set: ' + key);
              set = true;
              thisCache.set(key, data);
            }

            res.set('Cache-Control', 'private, max-age:' + Math.floor(thisCache.options.expire / 1000));
            res.header('X-Cache', 'no-hit; set:' + set);
            return data;
          }

          // Make overriding send functions
          res.json = function(data) {
            data = handleData(data);
            if (!res.headersSent && !res.get('Content-Type')) {
              res.set('Content-Type', 'application/json');
            }
            return res.send(JSON.stringify(data));
          };
          res.csv = function(data) {
            data = handleData(data);

            res.charset = this.charset || 'utf-8';
            if (!res.headersSent && !res.get('Content-Type')) {
              res.header('Content-Type', 'text/csv');
            }
            return res.send(data);
          };

          // Send along
          return next();
        }
        else {
          debug('Cache hit: ' + key);
          res.set('X-Cache', 'hit,stale:' + item.stale + ',refreshing:' + item.refreshing);
          res.json(item.value);
        }
      });
    }
  }
});


// Exports
module.exports = function(options) {
  return new Cache(options);
}
