/**
 * Test cache
 */

// Config
require('dotenv').config({ silent: true });

// Dependencies
const test = require('tape');
const redis = require('redis');
const cache = require('../lib/cache.js');

// Test get and set in memory
test('cache | set - get | memory', function(t) {
  var c = cache({
    prefix: 'test-cache-1'
  });

  var toTest = [
    ['testing-a', 1, 1],
    ['testing-b', 'a', 'a'],
    ['testing-c', null, null],
    ['testing-d', { things: 1, value: 'toTest' }, { things: 1, value: 'toTest' }]
  ];

  t.plan(toTest.length);
  toTest.forEach(function(set) {
    c.remove(set[0]);
    c.set(set[0], set[1]);
    t.deepEqual(c.get(set[0]).value, set[2]);
  });
});

// Test no cache
test('cache | no cache | memory', function(t) {
  var c = cache({
    prefix: 'test-cache-9'
  });

  var value = c.get('no-key-99');
  t.deepEqual(value, undefined);

  t.end();
});

// Test stale
test('cache | handle stale | memory', function(t) {
  var c = cache({
    prefix: 'test-cache-111',
    expire: 250
  });
  var key = 'testing-a';
  var value = 'testingStale';
  var newValue = 'refreshedStale';
  c.remove(key);

  // Initial set
  c.set(key, value);
  setTimeout(function() {
    var item = c.get(key);

    t.equal(item.value, value);

    // Check staleness
    t.equal(item.stale, true);
    t.equal(item.shouldRefresh, true);
    t.equal(item.refreshing, false);

    // While refreshing
    c.refreshing(key);
    setTimeout(function() {
      // Should still be stale but refreshing
      var item = c.get(key);
      t.equal(item.value, value);
      t.equal(item.shouldRefresh, false);
      t.equal(item.refreshing, true);
    }, 250);

    // Refresh
    setTimeout(function() {
      c.set(key, newValue);

      // Should not be stale
      var item = c.get(key);
      t.equal(item.value, newValue);
      t.equal(item.refreshing, false);
      t.equal(item.stale, false);

      t.end();
    }, 500);
  }, 500);
});

// Test get and set with redis
if (process.env.REDIS_URL) {
  test('cache | set - get | redis', function(t) {
    var client = redis.createClient(process.env.REDIS_URL);
    var c = cache({
      prefix: 'test-cache-2',
      redis: client
    });

    var toTest = [
      ['testing-a', 1, 1],
      ['testing-b', 'a', 'a'],
      ['testing-c', null, null],
      ['testing-d', { things: 1, value: 'toTest' }, { things: 1, value: 'toTest' }]
    ];

    t.plan(toTest.length);
    toTest.forEach(function(set) {
      c.remove(set[0]);
      c.set(set[0], set[1]);
      c.get(set[0], function(error, item) {
        t.deepEqual(item.value, set[2]);
      });
    });
  });

  test('cache | no cache | redis', function(t) {
    var client = redis.createClient(process.env.REDIS_URL);
    var c = cache({
      prefix: 'test-cache-3',
      redis: client
    });

    c.remove('no-key-10');
    c.get('no-key-10', function(error, item) {
      t.equal(item, undefined);
      t.end();
      client.quit();
    });
  });

  // Test stale
  test('cache | handle stale | redis', function(t) {
    var client = redis.createClient(process.env.REDIS_URL);
    var c = cache({
      prefix: 'test-cache-222',
      expire: 250,
      redis: client
    });
    var key = 'testing-b';
    var value = 'testingStale';
    var newValue = 'refreshedStale';
    c.remove(key);

    // Initial set
    c.set(key, value);
    setTimeout(function() {
      c.get(key, function(error, item) {
        t.equal(item.value, value);

        // Check staleness
        t.equal(item.stale, true);
        t.equal(item.shouldRefresh, true);
        t.equal(item.refreshing, false);

        c.refreshing(key);
      });

      // While refreshing
      setTimeout(function() {
        // Should still be stale but refreshing
        c.get(key, function(error, item) {
          t.equal(item.value, value);
          t.equal(item.shouldRefresh, false);
          t.equal(item.refreshing, true);
        });
      }, 250);

      // Refresh
      setTimeout(function() {
        c.set(key, newValue);

        // Should not be stale
        c.get(key, function(error, item) {
          t.equal(item.value, newValue);
          t.equal(item.refreshing, false);
          t.equal(item.stale, false);

          //client.quit();
          t.end();
        });
      }, 500);
    }, 500);
  });
}
