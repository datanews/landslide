/**
 * "API" parts.
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const db = require('./db.js')();
const utils = require('./utils.js');
require('dotenv').config({ silent: true });

// Main reports endpoint
function endpointReports(req, res) {
  try {
    req.query.q = req.query.q || '{}';
    req.query.q = JSON.parse(req.query.q);
    req.query.sort = req.query.sort || '{ "updated": -1 }';
    req.query.sort = JSON.parse(req.query.sort);
    req.query.limit = req.query.limit || 100;
    req.query.limit = parseInt(req.query.limit, 10);
  }
  catch (e) {
    console.error(e);
    req.query.q = {};
    req.query.sort = { updated: -1 };
    req.query.limit = 100;
  }

  db.models.Report.find(req.query.q)
    .sort(req.query.sort)
    .limit(req.query.limit)
    .exec(function(error, results) {
    if (error) {
      console.error(error);
      res.status(500);
      return res.json({
        status: 'error',
        statusCode: 500,
        message: 'Database error.'
      });
    }

    res.json(results || []);
  });
}

// Get options for a field from reports
function endpointReportsOptions(req, res) {
  req.query.field = req.query.field || 'state';
  const sort = {};
  sort[req.query.field] = 1;

  db.models.Report.find({}).sort(sort).distinct(req.query.field, function(error, values) {
    if (error) {
      console.error(error);
      res.status(500);
      return res.json({
        status: 'error',
        statusCode: 500,
        message: 'Database error.'
      });
    }

    res.json(values || []);
  });
}

// Endpoint to toggle check field
function endpointReportsToggleCheck(req, res) {
  db.models.Report.findOne({ id: req.query.id }).exec(function(error, report) {
    if (error || !report) {
      console.error(error);
      res.status(500);
      return res.json({
        status: 'error',
        statusCode: 500,
        message: 'Database error.'
      });
    }

    report.inCheck = !report.inCheck;
    report.save(function(error, report) {
      if (error || !report) {
        console.error(error);
        res.status(500);
        return res.json({
          status: 'error',
          statusCode: 500,
          message: 'Database error.'
        });
      }

      res.json(report);
    });
  });
}


// Exports
module.exports = {
  endpointReports: endpointReports,
  endpointReportsOptions: endpointReportsOptions,
  endpointReportsToggleCheck: endpointReportsToggleCheck
};
