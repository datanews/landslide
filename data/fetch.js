/**
 * Fetch data
 */


// Dependencies
const queue = require('d3-queue').queue;
const _ = require('lodash');
const db = require('../lib/db.js')();

const mc = require('./fetch-mobile-commons.js');
const sd = require('./fetch-screendoor.js');
const test = require('./fetch-test-generator.js');

// Fetch all
const q = queue();
q.defer(mc);
q.defer(sd);
q.defer(test);

// Done
q.awaitAll(function(error, fetched) {
  if (error) {
    throw _.isError(error) ? error : new Error(error);
  }
  const combined = [].concat(
    fetched[0] ? fetched[0] : [],
    fetched[1] ? fetched[1] : [],
    fetched[2] ? fetched[2] : [],
    fetched[3] ? fetched[3] : []
  );
  save(combined, function(error, saved) {
    if (error) {
      throw _.isError(error) ? error : new Error(error);
    }

    console.log("Saved: " + saved.length);
    db.connection.close();
  });
});

// Save data to the Database
function save(data, done) {
  var q = queue();
  var options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  };

  _.each(data, function(d) {
    q.defer(db.models.Report.findOneAndUpdate.bind(db.models.Report), { id: d.id }, d, options);
  });

  q.awaitAll(done);
}
