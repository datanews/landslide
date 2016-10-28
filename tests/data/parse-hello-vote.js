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
    first_name: null,
    phone_number: '+1234567890',
    reporting_wait_time: '15',
    reporting_story: 'this is a test story with location data',
    reporting_contact_ok: true,
    received: '2016-10-24T22:39:13Z',
    polling_location: {
      address: {
        locationName: 'AC TRANSIT DISTRICT LOBBY',
        line1: '1600 FRANKLIN ST OAK  SIDE B',
        line2: '1600 FRANKLIN ST ',
        city: 'Oakland',
        state: 'CA',
        zip: '94612'
      },
      lat: 37.80544,
      lon: -122.26886
    }
  };

  const expected = {
    id: 'hv-1234567890',
    phone: '+1234567890',
    source: 'hellovote',
    sourceName: 'HelloVote',
    address: '1600 FRANKLIN ST OAK  SIDE B',
    city: 'Oakland',
    state: 'CA',
    zip: '94612',
    fullAddress: '1600 FRANKLIN ST OAK SIDE B, Oakland, CA 94612',
    lat: 37.80544,
    lon: -122.26886,
    report: 'this is a test story with location data',
    wait: '15',
    waitMinutes: 15,
    contactable: true,
    //fetched: 1477321934,
    updated: 1477348753,
    pollSite: {
      locationName: 'AC TRANSIT DISTRICT LOBBY',
      line1: '1600 FRANKLIN ST OAK  SIDE B',
      line2: '1600 FRANKLIN ST ',
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
