/**
 * Parse hello-vote incoming data.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const debug = require('debug')('data:parse:hello-vote');
const utils = require('../lib/utils.js');

// Default timezone
moment.tz.setDefault('America/New_York');

// Parse data
function parse(incoming) {
  const fetched = moment().unix();
  if (!_.isArray(incoming) && !_.isObject(incoming)) {
    return [];
  }
  incoming = _.isObject(incoming) && !_.isArray(incoming) ? [ incoming ] : incoming;

  // Example
  /*
  {
    first_name: null,
    phone_number: '+1234567891',
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
  }
  */

  // Parse each object
  incoming = _.map(incoming, function(d) {
    var parsed = {};

    parsed.id = 'hv-' + utils.id(d.phone_number);
    parsed.source = 'hellovote';
    parsed.sourceName = 'HelloVote';
    parsed.phone = d.phone_number;

    if (d.polling_location) {
      if (d.polling_location.address) {
        parsed.address = d.polling_location.address.line1;
        parsed.city = d.polling_location.address.city;
        parsed.state = d.polling_location.address.state;
        parsed.zip = d.polling_location.address.zip;

        // Save object for reference
        parsed.pollSite = d.polling_location.address;
      }

      if (d.polling_location.lat && !_.isNaN(parseFloat(d.polling_location.lat))) {
        parsed.lat = parseFloat(d.polling_location.lat);
      }
      if (d.polling_location.lon && !_.isNaN(parseFloat(d.polling_location.lon))) {
        parsed.lon = parseFloat(d.polling_location.lon);
      }
    }

    parsed.contactable = utils.parseBooleanFromString(d.reporting_contact_ok);

    parsed.wait = d.reporting_wait_time;
    if (d.reporting_wait_time && !_.isNaN(parseFloat(d.reporting_wait_time))) {
      parsed.waitMinutes = parseFloat(d.reporting_wait_time);
    }

    parsed.report = d.reporting_story;

    parsed.updated = (d.received) ? moment.utc(d.received).unix() : fetched;
    parsed.fetched = fetched;

    // Combine address parts
    parsed.fullAddress = utils.makeAddress(parsed);

    return parsed;
  });

  // Filter bad ones
  return _.filter(incoming, function(d) {
    if (d.id === 'hv-' || !d.phone || !d.city) {
      return false;
    }

    return true;
  });
}

// Export
module.exports = parse;
