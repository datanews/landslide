/**
 * Fetch data
 */


// Dependencies
const queue = require('d3-queue').queue;
const _ = require('lodash');
const db = require('../lib/db.js')();

const mc = require('./fetch-mobile-commons.js');
const sd = require('./fetch-screendoor.js');

// Fetch all
const q = queue();
q.defer(mc);
q.defer(sd);

// Done
q.awaitAll(function(error, fetched) {
  if (error) {
    throw _.isError(error) ? error : new Error(error);
  }
  const combined = [].concat(fetched[0], fetched[1]);

  console.log(combined);

  db.connection.close();
});
