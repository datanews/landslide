/**
 * Test utils
 */

const test = require('tape');
const _ = require('lodash');
const parser = require('../../data/parse-hello-vote.js');

// Test hello vote parser
test('data | parse-hello-vote | parse', function(t) {
  t.plan(2);

  const incoming = {
    phone_number: '+1234567890',
    address: {
      locationName: 'AC TRANSIT DISTRICT LOBBY',
      line1: '1600 FRANKLIN ST OAK  SIDE B',
      line2: '1600 FRANKLIN ST',
      city: 'Oakland',
      state: 'CA',
      zip: '94612'
    },
    polling_location_lat: 12.345678,
    polling_location_lon: 98.765432,
    reporting_wait_time: 60,
    reporting_story: 'This is what happened at the poll site',
    reporting_contact_ok: true,
    received: '2016-11-08T19:20:30.45Z'
  };

  const expected = {
    id: 'hv-1234567890',
    phone: '+1234567890',
    source: 'hellovote',
    address: '1600 FRANKLIN ST OAK  SIDE B',
    city: 'Oakland',
    state: 'CA',
    zip: '94612',
    lat: 12.345678,
    lon: 98.765432,
    report: 'This is what happened at the poll site',
    wait: 60,
    waitMinutes: 60,
    contactable: true,
    //fetched: 1477321934,
    updated: 1478632830,
    pollSite: {
      locationName: 'AC TRANSIT DISTRICT LOBBY',
      line1: '1600 FRANKLIN ST OAK  SIDE B',
      line2: '1600 FRANKLIN ST',
      city: 'Oakland',
      state: 'CA',
      zip: '94612'
    }
  };

  // Not sure best way to have fetched be something specific
  const transformedArray = parser([ _.clone(incoming) ]);
  const transformedObject = parser(_.clone(incoming));
  const expectedArray = [ _.clone(expected) ];
  expectedArray[0].fetched = transformedArray[0].fetched;
  const expectedObject = _.clone(expected);
  expectedObject.fetched = transformedObject[0].fetched;

  t.deepEquals(transformedArray, expectedArray, 'parses incoming array of objects');
  t.deepEquals(transformedObject, [ expectedObject ], 'parses incoming object');
});
