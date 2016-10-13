/**
 * Database connection and models.
 */

// Dependencies
const mongoose = require('mongoose');
const _ = require('lodash');
require('dotenv').config({ silent: true });


// Connect
function DB(done) {
  mongoose.connect(process.env.DB_URI, done);
}

// Main model for data
const report = new mongoose.Schema({
  id:  { type: String, index: { unique: true }},
  source: { type: String, index: true },
  subSource: { type: String, index: true },
  phone: { type: String, index: true },
  state: String,
  city: String,
  zip: String,
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
module.exports = _.extend(DB, {
  models: {
    Report: Report
  },
  schemas: {
    report: report
  }
});
