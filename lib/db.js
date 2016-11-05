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
  id: { type: String, index: { unique: true }},
  source: { type: String, index: true },
  subSource: { type: String, index: true },
  sourceName: { type: String, index: true },
  private: { type: Boolean, default: false, index: true },
  phone: { type: String, index: true },
  address: { type: String, index: true },
  city: { type: String, index: true },
  state: { type: String, index: true },
  county: { type: String, index: true },
  zip: { type: String, index: true },
  fullAddress: { type: String, index: true },
  lat: { type: Number, index: true },
  lon: { type: Number, index: true },
  geocoded: { type: Boolean, default: false, index: true },
  geocodedAccuracy: String,
  geocodedFormatted: String,
  contactable: { type: Boolean, default: false, index: true },
  wait: { type: String, index: true },
  waitMinutes: { type: Number, index: true },
  report: { type: String },
  updated: { type: Number, index: true },
  fetched: { type: Number, index: true },
  inCheck: { type: Boolean, default: false, index: true },
  messages: [],
  electionProtection: {},
  pollSite: {
    locationName: { type: String }
  }
}, {
  strict: false
});
//report.index({ report: 'text' });
report.index({
  sourceName: 'text',
  fullAddress: 'text',
  geocodedFormatted: 'text',
  report: 'text',
  wait: 'text',
  'messages.body': 'text',
  'pollSite.locationName': 'text'
},
{
  weights: {
    fullAddress: 3,
    'messages.body': 3,
    'pollSite.locationName': 3
  },
  name: 'allTextSearch'
});
report.index({ lat: 1, lon: 1 });
report.index({ source: 1, subSource: 1 });

const Report = mongoose.model('Report', report);

// Model for location cache
const location = new mongoose.Schema({
  input: { type: String, index: { unique: true }},
  results: []
}, {
  strict: false
});

const Location = mongoose.model('Location', location);

// Function to update (or insert) report, specifically to handle the messages
// array
function updateReport(report, done) {
  if (!report) {
    return done('No report');
  }

  Report.findOne({ id: report.id }, function(error, existing) {
    var options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    };

    if (error) {
      return done(error);
    }

    // Existing, merge messages
    if (existing && _.isArray(existing.messages) && _.isArray(report.messages)) {
      report.messages = _.sortBy(_.uniqBy(report.messages.concat(existing.messages), 'id'), 'timestamp').reverse();
    }

    Report.findOneAndUpdate({ id: report.id }, report, options, done);
  });
}

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
    },
    updateReport: updateReport
  };
}
