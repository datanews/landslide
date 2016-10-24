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
    phone_number: '+1234567890',
    address: {
      locationName: 'AC TRANSIT DISTRICT LOBBY',
      line1: '1600 FRANKLIN ST OAK  SIDE B',
      line2: '1600 FRANKLIN ST',
      city: 'Oakland',
      state: 'CA',
      zip: '94612'
    },
    polling_location_lat: 12.345678, ?
    polling_location_lon: 98.765432, ?
    reporting_wait_time: 60,
    reporting_story: 'This is what happened at the poll site',
    reporting_contact_ok: true,
    received: '2016-11-08T19:20:30.45Z' ?
  }
  */

  // Parse each object
  incoming = _.map(incoming, function(d) {
    var parsed = {};

    parsed.id = 'hv-' + utils.id(d.phone_number);
    parsed.source = 'hellovote';
    parsed.phone = d.phone_number;

    if (d.address) {
      parsed.address = d.address.line1;
      parsed.city = d.address.city;
      parsed.state = d.address.state;
      parsed.zip = d.address.zip;
    }

    if (d.polling_location_lat && !_.isNaN(parseFloat(d.polling_location_lat))) {
      parsed.lat = parseFloat(d.polling_location_lat);
    }
    if (d.polling_location_lon && !_.isNaN(parseFloat(d.polling_location_lon))) {
      parsed.lon = parseFloat(d.polling_location_lon);
    }

    parsed.contactable = utils.parseBooleanFromString(d.reporting_contact_ok);

    parsed.wait = d.reporting_wait_time;
    if (d.reporting_wait_time && !_.isNaN(parseFloat(d.reporting_wait_time))) {
      parsed.waitMinutes = parseFloat(d.reporting_wait_time);
    }

    parsed.report = d.reporting_story;

    parsed.updated = (d.received) ? moment.utc(d.received).unix() : fetched;
    parsed.fetched = fetched;

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
