/**
 * Collect data from screendoor.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const path = require('path');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const querystring = require('querystring');
const parseLinkHeader = require('parse-link-header');
const debug = require('debug')('data:fetch:screendoor');
const utils = require('../lib/utils.js');

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

    try {
      body = JSON.parse(body);
    }
    catch(e) {
      return done(e);
    }

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
    parsed.id = 'sd-' + utils.id(d.id);
    parsed.source = 'screendoor';
    parsed.sourceName = 'Screendoor';
    parsed.phone = d.responses['40758'];
    parsed.city = d.responses['40763']
    parsed.state = utils.statesNames[d.responses['40764']] ? utils.statesNames[d.responses['40764']] : d.responses['40764'];
    parsed.contactable = !!d.responses['40758'];
    parsed.wait = d.responses['40759'];
    parsed.report = d.responses['40761'];
    parsed.updated = moment.utc(d.updated_at).unix();
    parsed.fetched = fetched;

    // Numbers cannot be undefined when updating
    if (d.responses['40760'] && !_.isNaN(parseFloat(d.responses['40760'].lat))) {
      parsed.lat = parseFloat(d.responses['40760'].lat);
    }
    if (d.responses['40760'] && !_.isNaN(parseFloat(d.responses['40760'].lng))) {
      parsed.lon = parseFloat(d.responses['40760'].lng);
    }
    if (utils.parseMinutes(d.responses['40759'])) {
      parsed.waitMinutes = utils.parseMinutes(d.responses['40759']);
    }

    // Combine address parts
    parsed.fullAddress = utils.makeAddress(parsed);

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
