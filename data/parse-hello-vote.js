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

  incoming = _.map(incoming, function(d) {
    var parsed = {};

    parsed.id = 'hv-' + utils.id(d.phone_number);
    parsed.source = 'hellovote';
    parsed.phone = d.phone_number;
    parsed.address = d.polling_location_address;
    parsed.city = d.polling_location_city;
    parsed.state = d.polling_location_state;
    parsed.zip = d.polling_location_zip;

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
    parsed.updated = moment.utc(d.received).unix();
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
