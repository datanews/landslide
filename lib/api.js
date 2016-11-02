/**
 * "API" parts.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const queue = require('d3-queue').queue;
const shorthash = require('shorthash');
const flat = require('flat');
const csv = require('d3-dsv').dsvFormat(',');
const debug = require('debug')('api');
const db = require('./db.js')();
const utils = require('./utils.js');
const parseHelloVote = require('../data/parse-hello-vote.js');

// Main reports endpoint
function endpointReports(req, res) {
  try {
    req.query.q = req.query.q || '{}';
    req.query.q = JSON.parse(req.query.q);
    req.query.sort = req.query.sort || '{ "updated": -1 }';
    req.query.sort = JSON.parse(req.query.sort);
    req.query.limit = req.query.limit || 250;
    req.query.limit = parseInt(req.query.limit, 10);
  }
  catch (e) {
    debug(e);
    req.query.q = {};
    req.query.sort = { updated: -1 };
    req.query.limit = 250;
  }

  // Check to see if this person can see private
  if (!req.session.user || !req.session.user.accessPrivate) {
    req.query.q.private = false;
  }

  db.models.Report.find(req.query.q)
    .sort(req.query.sort)
    .limit(req.query.limit)
    .exec(function(error, results) {
      if (error) {
        debug(error);
        res.status(500);
        return res.json({
          status: 'error',
          code: 500,
          message: 'Database error.'
        });
      }

      // Convert to JSON
      results = _.map(results, function(r) {
        return r.toJSON();
      });

      // Handle format request
      if (req.query.format === 'csv') {
        respondCSV(res, _.map(cleanReports(results, true), flat) || []);
      }
      else {
        res.json(cleanReports(results) || []);
      }
    });
}

// Get options for a field from reports
function endpointReportsOptions(req, res) {
  req.query.field = req.query.field || 'state';
  const sort = {};
  sort[req.query.field] = 1;

  db.models.Report.distinct(req.query.field, function(error, values) {
    if (error) {
      debug(error);
      res.status(500);
      return res.json({
        status: 'error',
        code: 500,
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
      debug(error);
      res.status(500);
      return res.json({
        status: 'error',
        code: 500,
        message: 'Database error.'
      });
    }

    report.inCheck = !report.inCheck;
    report.save(function(error, report) {
      if (error || !report) {
        debug(error);
        res.status(500);
        return res.json({
          status: 'error',
          code: 500,
          message: 'Database error.'
        });
      }

      res.json(report);
    });
  });
}

// "webhook" incoming data from Hello Vote
function endpointIncomingHelloVote(req, res) {
  // Make sure API key matches
  if (!req.query || req.query.key !== process.env.API_KEY_HELLO_VOTE) {
    debug('Unauthorized or no API key.');
    res.status(403);
    return res.json({
      status: 'error',
      code: 403,
      message: 'Unauthorized or no API key.'
    });
  }

  // Make sure there is a body
  if (!req.body || _.isEmpty(req.body)) {
    debug('No payload data found.');
    res.status(400);
    return res.json({
      status: 'error',
      code: 400,
      message: 'No payload data found.'
    });
  }

  // Make sure body is the write type
  if (!_.isArray(req.body) && !_.isObject(req.body)) {
    debug('Payload not array or object.');
    res.status(400);
    return res.json({
      status: 'error',
      code: 400,
      message: 'Payload not array or object.'
    });
  }

  // Make sure data is an object
  if (_.isArray(req.body) && !_.isObject(req.body[0])) {
    debug('Payload an array but contents not objects.');
    res.status(400);
    return res.json({
      status: 'error',
      code: 400,
      message: 'Payload an array but contents not objects.'
    });
  }

  // Parse
  var parsed;
  try {
    parsed = parseHelloVote(req.body);
  }
  catch(e) {
    debug('Error parsing payload: ' + e.toString());
    res.status(500);
    return res.json({
      status: 'error',
      code: 500,
      message: 'Error parsing payload.'
    });
  }

  // Save
  const q = queue(1);
  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  };
  _.each(parsed, function(p) {
    q.defer(db.models.Report.findOneAndUpdate.bind(db.models.Report), { id: p.id }, p, options);
  });

  // All done
  q.awaitAll(function(error, saved) {
    if (error) {
      debug('Error saving to database: ' + error.toString());
      res.status(500);
      return res.json({
        status: 'error',
        code: 500,
        message: 'Error saving to database.'
      });
    }

    res.json({
      status: 'ok',
      saved: saved.length
    });
  });
}

// Cleanup raw results for privacy
function cleanReports(reports, isCSV) {
  return _.map(reports, function(r) {
    if (isCSV) {
      r.id = shorthash.unique(r.id);
      delete r._id;

      r.messages = _.map(r.messages, function(m) {
        return '[' + m.timestamp + '] ' + m.body
      });
      r.messages = r.messages.join(' | ');
    }

    if (!r.contactable) {
      r.phone = undefined;
    }

    // TODO when ready, remove election protection

    return r;
  });
}

// Since the hash/fragment is not set to server, try to get it from the client
function endpointStoreHash(req, res) {
  if (req.query && req.query.hash) {
    req.session.hash = req.query.hash;
    res.json({
      status: 'ok',
      message: 'Saved to session'
    });
  }
  else {
    res.status(500);
    res.json({
      status: 'error',
      code: 500,
      message: 'Not saved to session'
    });
  }
}

// Geo data of reports
function endpointGeo(req, res) {
  var query = {};
  if (!req.session.user || !req.session.user.accessPrivate) {
    query.private = false;
  }

  // For each lat,lon pair computer number of reports and get each wait time
  var options = {
    map: function() {
      var key = this.lat ? this.lat + ',' + this.lon : 'noLocation';
      emit(key, {
        wait: this.waitMinutes,
        report: this.report ? 1 : 0
      });
    },
    reduce: function(source, values) {
      return {
        reports: values.reduce(function(p, v) {
          return p + v.report;
        }, 0),
        waitTimes: values.map(function(v) {
          return v.wait;
        })};
    },
    query: query,
    sort: { sourceName: 1 }
  };

  // Execute map-reduce command
  db.models.Report.mapReduce(options, function(error, results) {
    if (error) {
      debug('Error retrieving from database: ' + error.toString());
      res.status(500);
      return res.json({
        status: 'error',
        code: 500,
        message: 'Error retrieving from database.'
      });
    }

    // Clean up
    var cleaned = {}
    _.each(results, function(r) {
      var c = {};
      if (r._id === 'noLocation') {
        return;
      }

      c.lat = parseFloat(r._id.split(',')[0]);
      c.lon = parseFloat(r._id.split(',')[1]);
      c.waitTimes = r.value.wait ? [ r.value.wait ] :
        r.value.waitTimes ? r.value.waitTimes : [];
      c.reports = r.value.report ? r.value.report :
        r.value.reports ? r.value.reports : 0;
      cleaned[r._id] = c;
      c.waitTimes = _.filter(c.waitTimes);
    });
    cleaned = _.filter(cleaned, function(c) {
      return c.reports || c.waitTimes.length;
    });

    res.json(cleaned);
  });
}

// Get stats for all reports.
function endpointStats(req, res) {
  var query = {};
  if (!req.session.user || !req.session.user.accessPrivate) {
    query.private = false;
  }
  var promises = [];

  // Aggregate all
  promises.push(db.models.Report.aggregate([
    { $match: query },
    { '$group': {
      '_id': '_id',
      'totalCount': { '$sum': 1 },
      'waitSum': { '$sum': '$waitMinutes' },
      'waitMin': { '$min': '$waitMinutes' },
      'waitMax': { '$max': '$waitMinutes' },
      'waitAvg': { '$avg': '$waitMinutes' },
      'lastFetch': { '$max': '$fetched' }
    }}
  ]));

  // Aggregate with wait time
  var queryWait = _.clone(query);
  queryWait.waitMinutes = { '$gt': 0, '$exists': true, $nin: [ null ] };
  promises.push(db.models.Report.aggregate([
    { $match: queryWait },
    { '$group': {
      '_id': '_id',
      'totalCount': { '$sum': 1 },
      'waitAvg': { '$avg': '$waitMinutes' }
    }}
  ]));

  // Count reports
  var queryReports = _.clone(query);
  queryReports.report = { '$exists': true, $nin: [ null ] };
  promises.push(db.models.Report.aggregate([
    { $match: queryReports },
    { '$group': {
      '_id': '_id',
      'totalCount': { '$sum': 1 }
    }}
  ]));

  Promise.all(promises).then(function(results) {
    res.json({
      all: results[0],
      wait: results[1],
      reports: results[2]
    });
  },
  function(error) {
    debug('Error retrieving from database: ' + error.toString());
    res.status(500);
    return res.json({
      status: 'error',
      code: 500,
      message: 'Not saved to session'
    });
  });
}

// Respond with csv
function respondCSV(res, data) {
  res.charset = this.charset || 'utf-8';
  res.header('Content-Type', 'text/csv');
  res.send(csv.format(data));
}


// Exports
module.exports = {
  endpointReports: endpointReports,
  endpointReportsOptions: endpointReportsOptions,
  endpointReportsToggleCheck: endpointReportsToggleCheck,
  endpointIncomingHelloVote: endpointIncomingHelloVote,
  endpointStoreHash: endpointStoreHash,
  endpointStats: endpointStats,
  endpointGeo: endpointGeo
};
