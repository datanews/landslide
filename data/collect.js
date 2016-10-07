/**
 * Main data collection.
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
    return xmlParse(fs.readFileSync(path.join(__dirname, "./example.xml"), "utf-8"), done);
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

  messages.forEach(function(m) {
    var p = {};

    // We look at profile data, as this holds the custom columns, which there
    // are one per profile, though we can know when they last updated it
    p.phone = m.profile[1].phone_number[0];
    p.zip = m.profile[1].address[0].postal_code[0];
    p.city = m.profile[1].address[0].city[0];
    p.state = m.profile[1].address[0].state[0];
    p.lastFetch = lastFetch;

    // TODO: Determine opt-in path

    // Custom columns
    m.profile[1].custom_columns[0].custom_column.forEach(function(c) {
      if (c._) {
        p[c.$.name] = {
          value: c._.trim(),
          updated: c.$.updated_at
        }
      }
    });

    parsed.push(p);
  });

  // Only one per phone number
  parsed = _.uniqBy(parsed, 'phone');

  // Filter out data we are not concerned with
  parsed = parsed.filter(function(p) {
    return (p.ElectionReport && p.ElectionReport.updated) || (p.ElectionWait && p.ElectionWait.updated);
  });

  // Opted in
  parsed = parsed.map(function(p) {
    const ok = (p.OKtoContact && p.OKtoContact.value) ? p.OKtoContact.value.toLowerCase() : '';
    p.canContact = false;

    if (ok === 'yes' || ok === 'y' || ok === 'si' || ok === 'sí') {
      p.canContact = true;
    }

    return p;
  });

  // Save out.
  // TODO: move to database
  mkdirp.sync(path.join(__dirname, 'collected'));
  fs.writeFileSync(path.join(__dirname, 'collected', 'all.json'), JSON.stringify(parsed));
}

// Get data
function collectData(done) {
  var messages = [];

  // For recursive handling of pages
  function getPage(page) {
    var p;
    var pLimit;

    getData(page, function(error, parsed) {
      if (error || !parsed.response.messages) {
        return done(error);
      }

      // Collect
      messages = messages.concat(parsed.response.messages[0].message);

      // Page info
      p = parsed.response.messages[0].$.page;
      pLimit = parsed.response.messages[0].$.page_count;

      // If not last page, keep going
      if (p < pLimit) {
        getPage(page++);
      }
      else {
        parseData(null, messages, done);
      }
    });
  }

  getPage(1);
}

// Go
collectData(function(error) {
  if (error) {
    throw new Error(error);
  }
});
