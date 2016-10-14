/**
 * Collect data from mobile commons.
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const mkdirp = require('mkdirp');
const moment = require('moment-timezone');
const querystring = require('querystring');
const xmlParse = require('xml2js').parseString;
const utils = require('../lib/utils.js');
require('dotenv').config({ silent: true });

// Mobile commons API sucks
var TEST = false;

// Default timezone
moment.tz.setDefault('America/New_York');

// Mobile Commons API template
const urlTemplate = (a) => `https://secure.mcommons.com/api/messages?campaign_id=${ a.MOBILE_COMMONS_CAMPAIGN }&include_profile=true&limit=100&page=${ a.page }`;

// Make a data call
function getData(page, done) {
  page = _.isUndefined(page) ? 1 : page;
  done = _.isFunction(done) ? done : function() { return; };
  const params = _.extend(_.clone(process.env), {
    page: page,
    q: querystring
  });
  const url = urlTemplate(params);
  const auth = 'Basic ' + new Buffer(process.env.MOBILE_COMMONS_USER + ':' + process.env.MOBILE_COMMONS_PASS).toString('base64');

  // Just send test back
  if (TEST) {
    return xmlParse(fs.readFileSync(path.join(__dirname, "../tests/mobile-commons-example.xml"), "utf-8"), done);
  }

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

  messages.forEach(function(m) {
    var p = {};
    var custom = {};
    var max;

    // Collect raw messages
    messagesByPhone[m.phone_number[0]] = messagesByPhone[m.phone_number[0]] || [];
    messagesByPhone[m.phone_number[0]].push({
      id: m.$.id,
      body: m.body[0],
      timestamp: moment.utc(m.received_at[0]).unix()
    });

    // Make sure active
    if (m.profile[1].status[0] !== 'Active Subscriber') {
      return;
    }

    // Source and ID
    p.id = 'mc-' + m.profile[1].$.id;
    p.source = 'mobile-commons';

    // We look at profile data, as this holds the custom columns, which there
    // are one per profile, though we can know when they last updated it
    p.phone = m.profile[1].phone_number[0];
    p.city = m.profile[1].location[0].city[0];
    p.state = m.profile[1].location[0].state[0];
    p.zip = m.profile[1].location[0].postal_code[0];

    // Opt-in TODO:
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
    }

    // Determine last update from custom fields
    max = _.max(_.filter(custom, function(c) {
      return ['ElectionReport', 'ElectionWait'].indexOf(c.name) !== -1;
    }), 'updated');
    if (max) {
      p.updated = max.updated.unix();
    }

    // Mark when we last got this
    p.lastFetch = lastFetch;

    parsed.push(p);
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
      p = data.response.messages[0].$.page;
      pLimit = data.response.messages[0].$.page_count;

      // If not last page, keep going
      if (p < pLimit) {
        getPage(++page);
      }
      else {
        parseData(null, messages, done);
      }
    });
  }

  getPage(1);
}

// Export
module.exports = collectData;
