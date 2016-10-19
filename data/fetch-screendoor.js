/**
 * Collect data from screendoor.
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const querystring = require('querystring');
const parseLinkHeader = require('parse-link-header');
const utils = require('../lib/utils.js');
require('dotenv').config({ silent: true });

// Default timezone
moment.tz.setDefault('America/New_York');

// URL template
const urlTemplate = (a) => `https://screendoor.dobt.co/api/projects/${ a.SCREENDOOR_PROJECT }/responses?v=0&sort=responses_updated_at&direction=desc&per_page=100&api_key=${ a.SCREENDOOR_KEY }`;

// Make call
function screendoorCall(url, done) {
  url = url || urlTemplate(process.env);
  request.get(url, function(error, response, body) {
    if (error || response.statusCode >= 300) {
      return done(error || response.statusCode);
    }

    body = JSON.parse(body);
    var links = parseLinkHeader(response.headers.link);
    if (_.isArray(body)) {
      done(null, body, links);
    }
    else {
      return done("Unknown data reponse: " + JSON.stringify(body));
    }
  });
}

// Get all recursively
function getAll(done) {
  var collected = [];

  function getPage(url) {
    screendoorCall(url, function(error, data, links) {
      if (error) {
        return done(error);
      }

      collected = collected.concat(data);
      if (links && links.next) {
        getPage(links.next);
      }
      else {
        done(null, collected);
      }
    });
  }

  getPage();
}

// Parse results
function parseResults(data) {
  var fetched = moment().unix();

  data = data.map(function(d) {
    var parsed = {};
    parsed.id = 'sd-' + d.id;
    parsed.source = 'screendoor';
    parsed.phone = d.responses['40758'];
    parsed.city = d.responses['40763']
    parsed.state = utils.statesNames[d.responses['40764']] ? utils.statesNames[d.responses['40764']] : d.responses['40764'];
    parsed.lat = d.responses['40760'] ? parseFloat(d.responses['40760'].lat) : undefined;
    parsed.lon = d.responses['40760'] ? parseFloat(d.responses['40760'].lng) : undefined;
    parsed.contactable = !!d.responses['40758'];
    parsed.report = d.responses['40761'];
    parsed.updated = moment.utc(d.updated_at).unix();
    parsed.fetched = fetched;

    return parsed;
  });

  return data;
}

// Export
module.exports = function(done) {
  getAll(function(error, data) {
    done(error, !error ? parseResults(data) : null);
  });
}
