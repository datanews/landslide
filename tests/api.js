/**
 * Test API enpoints
 */

// Dependencies
const test = require('tape');
const supertest = require('supertest');
const server = require('../lib/server.js');
const db = require('../lib/db.js')();

// Set API key
process.env.API_KEY_HELLO_VOTE = 'temp-key';

// Disconnect DB when finished
test.onFinish(function() {
  db.disconnect();
});

// No API key
test('api | api/incoming/hello-vote | no api key', function(t) {
  supertest(server)
    .post('/api/incoming/hello-vote')
    .set('Accept', 'application/json')
    .expect(403)
    .end(function(error, res) {
      t.error(error, 'no error');
      t.equals(res.statusCode, 403, 'returns 403');
      t.ok(res.body, 'has body response');
      t.ok(res.body.message, 'has message');
      t.equals(res.body.code, 403, 'has 403 code');
      t.end();
    });
});

// API key, but no body
test('api | api/incoming/hello-vote | no body', function(t) {
  supertest(server)
    .post('/api/incoming/hello-vote?key=' + process.env.API_KEY_HELLO_VOTE)
    .set('Accept', 'application/json')
    .expect(400)
    .end(function(error, res) {
      t.error(error, 'no error');
      t.equals(res.statusCode, 400, 'returns 400');
      t.ok(res.body, 'has body response');
      t.ok(res.body.message, 'has message');
      t.equals(res.body.code, 400, 'has 400 code');
      t.end();
    });
});

// API bad object should not save
test('api | api/incoming/hello-vote | bad object should not save', function(t) {
  var incoming = {
    thisTest: 'should not save',
    name: 2
  };

  supertest(server)
    .post('/api/incoming/hello-vote?key=' + process.env.API_KEY_HELLO_VOTE)
    .send(incoming)
    .expect(200)
    .end(function(error, res) {
      t.error(error, 'no error');
      t.equals(res.statusCode, 200, 'returns 400');
      t.ok(res.body, 'has body response');
      t.equals(res.body.status, 'ok', 'is ok');
      t.equals(res.body.saved, 0, 'none saved');
      t.end();
    });
});

// API should save
test('api | api/incoming/hello-vote | object should not save', function(t) {
  var incoming = {
    phone_number: '+1234567890',
    polling_location_address: '123 Way St',
    polling_location_city: 'Minneapolis',
    polling_location_state: 'MN',
    polling_location_zip: '55401',
    polling_location_lat: 12.345678,
    polling_location_lon: 98.765432,
    reporting_wait_time: 60,
    reporting_story: 'This is what happened at the poll site',
    reporting_contact_ok: true,
    received: '2016-11-08T19:20:30.45Z'
  };

  supertest(server)
    .post('/api/incoming/hello-vote?key=' + process.env.API_KEY_HELLO_VOTE)
    .send(incoming)
    .expect(200)
    .end(function(error, res) {
      t.error(error, 'no error');
      t.equals(res.statusCode, 200, 'returns 400');
      t.ok(res.body, 'has body response');
      t.equals(res.body.status, 'ok', 'is ok');
      t.equals(res.body.saved, 1, '1 saved');
      t.end();
    });
});
