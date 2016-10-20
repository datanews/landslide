/**
 * Scheduler for fetching data.
 */

// Dependencies
const fetch = require('./data/fetch.js');

// Are we still fetching
var fetching = true;
const interval = 1000 * 60 * 1;

// Recursive function
function doFetch() {
  console.log('Fetching...');

  fetch(function(error, reports) {
    if (error) {
      console.error(error);
    }
    else {
      console.log('Saved reports: ' + reports.length);
    }

    if (fetching) {
      setTimeout(doFetch, interval);
    }
  });
}

doFetch();
