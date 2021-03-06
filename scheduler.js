/**
 * Scheduler for fetching data.
 */

// Configure
require('dotenv').config({ silent: true });

// New relic monitoring, useing environment variables
if (process.env.NEW_RELIC_NO_CONFIG_FILE && process.env.NEW_RELIC_APP_NAME) {
  require('newrelic');
}

// Dependencies
const fetch = require('./data/fetch.js');
const debug = require('debug')('scheduler');

// Are we still fetching
var fetching = true;
const interval = process.env.FETCH_INTERVAL_SECONDS ?
  process.env.FETCH_INTERVAL_SECONDS * 1000 : 1000 * 60 * 2;

// Recursive function
function doFetch() {
  debug('Fetching...');

  fetch(function(error, reports) {
    if (error) {
      debug('error: ' + error);
    }
    else {
      debug('Saved reports: ' + reports.length);
    }

    if (fetching) {
      setTimeout(doFetch, interval);
    }
  });
}

doFetch();
