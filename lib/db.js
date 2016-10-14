/**
 * Database connection and models.
 */

// Dependencies
const mongoose = require('mongoose');
const _ = require('lodash');
require('dotenv').config({ silent: true });


// Connect
function connect(done) {
  done = done || _.noop;
  const connection = mongoose.connection;

  // Check if already connected
  if (mongoose.connection.readyState > 0) {
    done(null, connection);
  }
  else {
    mongoose.connect(process.env.TEST ? process.env.DB_URI + '-test' : process.env.DB_URI, done);
    connection.on('error', console.error.bind(console, 'DB connection error:'));
  }

  return connection;
}

// Main model for data
const report = new mongoose.Schema({
  id:  { type: String, index: { unique: true }},
  source: { type: String, index: true },
  subSource: { type: String, index: true },
  phone: { type: String, index: true },
  city: String,
  state: String,
  zip: String,
  lat: Number,
  lon: Number,
  contactable: { type: Boolean, default: false, index: true },
  wait: String,
  report: String,
  updated: Number,
  fetched: Number,
  inCheck: { type: Boolean, default: false, index: true },
  messages: []
}, {
  strict: false
});

const Report = mongoose.model('Report', report);

// Exports
module.exports = function() {
  const connection = connect();

  return {
    connection: connection,
    mongoose: mongoose,
    disconnect: function() {
      mongoose.connection.close();
    },
    models: {
      Report: Report
    },
    schemas: {
      report: report
    }
  };
}
