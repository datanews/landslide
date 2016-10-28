/**
 * Collect data from mobile commons.
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
const xmlParse = require('xml2js').parseString;
const debug = require('debug')('data:fetch:mobile-commons');
const utils = require('../lib/utils.js');

// Default timezone
moment.tz.setDefault('America/New_York');

// Mobile Commons API template
const urlTemplate = (a) => `https://secure.mcommons.com/api/messages?campaign_id=${ a.MOBILE_COMMONS_CAMPAIGN }&include_profile=true&limit=100&start_time=${ a.start }&page=${ a.page }`;

// The first time we get the data, we'll get all of it, but subsequent requests
// should be only the past hour.
var dataStart = moment.utc('2016-10-01T00:00:00Z');

// Make a data call
function getData(page, done) {
  page = _.isUndefined(page) ? 1 : page;
  done = _.isFunction(done) ? done : function() { return; };
  const params = _.extend(_.clone(process.env), {
    page: page,
    start: querystring.escape(dataStart.format())
  });
  const url = urlTemplate(params);
  const auth = 'Basic ' + new Buffer(process.env.MOBILE_COMMONS_USER + ':' + process.env.MOBILE_COMMONS_PASS).toString('base64');
  debug(url);

  // Make call
  request.get({
    url : url,
    headers : {
      Authorization: auth,
      Accept: 'application/xml'
    }
  }, function(error, response, body) {
    if (error || response.statusCode >= 300) {
      return done(error || response.statusCode);
    }

    if (body) {
      xmlParse(body, done);
    }
    else {
      return done('No body');
    }
  });
}

// Parse data
function parseData(error, messages, done) {
  var parsed = [];
  var lastFetch = moment().unix();
  var messagesByPhone = {};
  var messagesByPhoneTime = {};

  messages.forEach(function(m) {
    var p = {};
    var custom = {};
    var message;
    var max;

    // If there are no records, this is undefined
    if (!m || !m.phone_number) {
      return;
    }

    // Have run into intermittent errors here
    try {
      message = {
        id: m.$.id,
        body: m.body[0],
        timestamp: moment.utc(m.received_at[0]).unix(),
        type: m.$.type
      };

      // Collect raw messages.  Mobile commons doesn't handle multiple part
      // messages, so custom fields are just random part of a multipart
      // message, so this is needed for manual review.
      messagesByPhone[m.phone_number[0]] = messagesByPhone[m.phone_number[0]] || [];
      messagesByPhone[m.phone_number[0]].push(message);

      // Make sure active
      if (m.profile[1].status[0] !== 'Active Subscriber') {
        return;
      }

      // Source and ID
      p.id = 'mc-' + utils.id(m.profile[1].$.id);
      p.source = 'mobile-commons';

      // We look at profile data, as this holds the custom columns, which there
      // are one per profile, though we can know when they last updated it
      p.phone = m.profile[1].phone_number[0];
      p.city = m.profile[1].location[0].city[0];
      p.state = m.profile[1].location[0].state[0];
      p.zip = m.profile[1].location[0].postal_code[0];

      // Opt-in
      p.subSource = m.profile[1].source[0].$.name;

      // Custom columns
      m.profile[1].custom_columns[0].custom_column.forEach(function(c) {
        if (c._ && c.$.updated_at) {
          custom[c.$.name] = {
            name: c.$.name,
            value: c._.trim(),
            updated: moment.utc(c.$.updated_at)
          }
        }
      });
      if (custom.OKtoContact && utils.parseBooleanFromString(custom.OKtoContact.value)) {
        p.contactable = true;
      }
      if (custom.ElectionReport) {
        p.report = custom.ElectionReport.value;
      }
      if (custom.ElectionWait) {
        p.wait = custom.ElectionWait.value;
        if (utils.parseMinutes(custom.ElectionWait.value)) {
          p.waitMinutes = utils.parseMinutes(custom.ElectionWait.value);
        }
      }

      // Determine last update from custom fields
      max = _.max(_.filter(custom, function(c) {
        return ['ElectionReport', 'ElectionWait'].indexOf(c.name) !== -1;
      }), 'updated');
      if (max) {
        p.updated = max.updated.unix();
      }

      // Mark when we last got this
      p.fetched = lastFetch;

      parsed.push(p);
    }
    catch (e) {
      debug(JSON.stringify(m, null, '  '));
      debug('error parsing mobile commons record: ' + e);
    }
  });

  // Only one per phone number
  parsed = _.uniqBy(parsed, 'id');

  // Only pass data that has something in it
  parsed = _.filter(parsed, function(p) {
    return p.report || p.wait;
  });

  // Add in raw messages for reference
  parsed = _.map(parsed, function(p) {
    p.messages = messagesByPhone[p.phone] ? messagesByPhone[p.phone] : [];
    return p;
  });

  // Save out.
  done(null, parsed);
}

// Get data
function collectData(done) {
  var messages = [];

  // For recursive handling of pages
  function getPage(page) {
    var p;
    var pLimit;

    getData(page, function(error, data) {
      if (error || !data.response.messages) {
        return done(error);
      }

      // Collect
      messages = messages.concat(data.response.messages[0].message);

      // Page info
      p = parseInt(data.response.messages[0].$.page, 10);
      pLimit = parseInt(data.response.messages[0].$.page_count, 10);

      // If not last page, keep going
      if (_.isNumber(p) && _.isNumber(pLimit) && p < pLimit) {
        getPage(++page);
      }
      else {
        dataStart = moment.utc().subtract(process.env.FETCH_SINCE_MINUTES, 'minutes');
        parseData(null, messages, done);
      }
    });
  }

  getPage(1);
}

// Export
module.exports = collectData;
