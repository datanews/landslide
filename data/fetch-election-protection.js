/**
 * Collect data from election protection API.
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const querystring = require('querystring');
const utils = require('../lib/utils.js');
require('dotenv').config({ silent: true });

// Default timezone
moment.tz.setDefault('America/New_York');

// Mobile Commons API template
const urlTemplate = (a) => `https://election-protection.example/?api_key=${ a.ELECTION_PROTECTION_KEY }`;

// Make a data call
function dataCall(done) {
  done = _.isFunction(done) ? done : function() { return; };
  const url = urlTemplate(process.env);

  // Make call
  request.get(url, function(error, response, body) {
    if (error || response.statusCode >= 300) {
      return done(error || response.statusCode);
    }

    body = JSON.parse(body);
    if (_.isArray(body)) {
      done(null, body);
    }
    else {
      return done("Unknown data reponse: " + JSON.stringify(body));
    }
  });
}

// Parse results
function parseResults(data) {
  var fetched = moment().unix();

  data = data.map(function(d) {
    var parsed = {};

    /*
    parsed.id = 'sd-' + d.id;
    parsed.source = 'screendoor';
    parsed.phone = d.responses['40758'];
    parsed.city = d.responses['40763']
    parsed.state = utils.statesNames[d.responses['40764']] ? utils.statesNames[d.responses['40764']] : d.responses['40764'];
    parsed.lat = d.responses['40760'] ? parseFloat(d.responses['40760'].lat) : undefined;
    parsed.lon = d.responses['40760'] ? parseFloat(d.responses['40760'].lng) : undefined;
    parsed.contactable = !!d.responses['40758'];
    parsed.wait = d.responses['40759'];
    parsed.report = d.responses['40761'];
    parsed.updated = moment.utc(d.updated_at).unix();
    parsed.fetched = fetched;
    */

    return parsed;
  });

  return data;
}

// Export
module.exports = function(done) {
  dataCall(function(error, data) {
    done(error, !error ? parseResults(data) : null);
  });
}
