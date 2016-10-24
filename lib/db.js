/**
 * Database connection and models.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const mongoose = require('mongoose');
const _ = require('lodash');
const debug = require('debug')('db');


// Connect
function connect(done) {
  done = done || _.noop;
  const connection = mongoose.connection;

  // Check if already connected
  if (mongoose.connection.readyState > 0) {
    done(null, connection);
  }
  else {
    mongoose.connect(process.env.NODE_ENV === 'test' ? process.env.MONGODB_URI + '-test' : process.env.MONGODB_URI, done);
    connection.on('error', debug);
  }

  return connection;
}

// Main model for data
const report = new mongoose.Schema({
  id:  { type: String, index: { unique: true }},
  source: { type: String, index: true },
  subSource: { type: String, index: true },
  phone: { type: String, index: true },
  address: String,
  city: String,
  state: String,
  zip: String,
  lat: Number,
  lon: Number,
  geocoded: { type: Boolean, default: false, index: true },
  geocodedAccuracy: String,
  geocodedFormatted: String,
  contactable: { type: Boolean, default: false, index: true },
  wait: String,
  waitMinutes: Number,
  report: String,
  updated: Number,
  fetched: Number,
  inCheck: { type: Boolean, default: false, index: true },
  messages: []
}, {
  strict: false
});

const Report = mongoose.model('Report', report);

// Model for location cache
const location = new mongoose.Schema({
  input: { type: String, index: { unique: true }},
  results: []
}, {
  strict: false
});

const Location = mongoose.model('Location', location);

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
      Report: Report,
      Location: Location
    },
    schemas: {
      report: report,
      location: location
    }
  };
}
