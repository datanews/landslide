/**
 * Scheduler for fetching data.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const fetch = require('./data/fetch.js');
const debug = require('debug')('scheduler');

// Are we still fetching
var fetching = true;
const interval = 1000 * 60 * 1;

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
