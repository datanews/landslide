/**
 * Main server.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const fs = require('fs');
const path = require('path');
const redis = require('redis');
const express = require('express');
const passport = require('passport');
const favicon = require('serve-favicon');
const i18n = require('i18n');
const _ = require('lodash');
const debug = require('debug')('server');

const db = require('./db.js')();
const utils = require('./utils.js');
const auth = require('./auth.js');
const api = require('./api.js');
const session = require('./session.js');
const cache = require('./cache.js');

// Use Slack for auth
// See: https://api.slack.com/docs/sign-in-with-slack
passport.use('slack', auth.slackStrategy);
passport.use('http', auth.httpStrategy);

// Create a new Express application.
const app = express();

// Redirect to HTTPS on production
if (process.env.NODE_ENV === 'production') {
  app.use(function(req, res, next) {
    if (req.get('x-forwarded-proto') !== 'https') {
      return res.redirect('https://' + req.hostname + req.originalUrl);
    }
    else {
      return next();
    }
  });
}

// Configure view engine to render EJS templates.
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// Setup static files
const cacheAge = process.env.NODE_ENV === 'production' ? 1000 * 60 * 60 : undefined;
app.use(express.static(path.join(__dirname, '../static'), { maxAge: cacheAge }));
app.use(favicon(path.join(__dirname, '../static/media/favicon.ico')));

// i18n
i18n.configure({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  directory: path.join(__dirname, '../locales'),
  cookie: 'language',
  queryParameter: 'lang',
  updateFiles: false
});

// HTTP output for dev
if (process.env.NODE_ENV === 'development') {
  app.use(require('morgan')('combined'));
}

// Body parser
app.use(require('body-parser').json({
  limit: '3mb'
}));

// Session
app.use(session());

// Persist language change via query param.  i18n expects
// language in cookie, though express-session handles
// it now.
app.use(function setLang(req, res, next) {
  req.session.user = req.session.user || {};

  if (req.query.lang) {
    req.session.language = req.query.lang;
  }
  if (req.session.language) {
    req.cookies = req.cookies || {};
    req.cookies.language = req.session.language;
  }

  return next();
});

// i18n init parses req for language headers, cookies, etc.
app.use(i18n.init);

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Add some data for templates
app.use(function templateData(req, res, next) {
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.config = process.env;
  res.locals.user = req.session.user || null;
  return next();
});

// Create CSV function
app.use(function(req, res, next) {
  res.csv = function(data) {
    res.charset = this.charset || 'utf-8';
    res.header('Content-Type', 'text/csv');
    res.send(data);
  }
  next();
});

// Default cache options
jsonCache = cache({
  prefix: 'json-',
  expire: 1000 * 45,
  redis: (process.env.REDIS_URL) ? redis.createClient(process.env.REDIS_URL) : undefined,
  key: function(req, res) {
    return req.originalUrl + '||' +
      ((req.session && req.session.user && req.session.user.accessPrivate) ? 'private' :
      (req.session && req.session.user && !req.session.user.accessPrivate) ? 'no-private' : 'no-user');
  }
});

// Slack auth routes
app.get('/auth/slack', passport.authorize('slack'));
app.get('/auth/slack/callback',
  passport.authorize('slack', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

// Login.  Check type of auth.
if (!utils.falsey(process.env.HTTP_AUTH_CONTINGENCY)) {
  app.get('/login',
    passport.authorize('http'),
    auth.isLoggedIn(undefined, undefined, '/'),
    function(req, res, next) {
      res.render('login', {
        title: 'Login'
      });
    });
}
else {
  app.get('/login',
    function(req, res, next) {
      res.render('login', {
        title: 'Login'
      });
    });
}

// Logout
app.get('/logout',
  auth.isLoggedIn(),
  function(req, res) {
    req.logout();
    req.session.destroy();
    res.redirect('/');
  });

// Main page
app.get('/',
  auth.isLoggedIn(),
  useHash,
  function(req, res) {
    res.render('home', {
      title: 'Home'
    });
  });

// API endpoints.  Get reports
app.get('/api/reports',
  auth.isLoggedIn('/api/unauthorized'),
  jsonCache.middleware(),
  api.endpointReports);

// Get report options (unique values for fields)
app.get('/api/reports/options',
  auth.isLoggedIn('/api/unauthorized'),
  jsonCache.middleware(),
  api.endpointReportsOptions);

// Top level stats
app.get('/api/reports/stats',
  auth.isLoggedIn('/api/unauthorized'),
  jsonCache.middleware(),
  api.endpointStats);

// Report geo points
app.get('/api/reports/geo',
  auth.isLoggedIn('/api/unauthorized'),
  jsonCache.middleware(),
  api.endpointGeo);

// Toggle inCheck flag
app.get('/api/reports/toggle-check',
  auth.isLoggedIn('/api/unauthorized'),
  api.endpointReportsToggleCheck);

// Set report data from hellow vote
app.post('/api/incoming/hello-vote',
  api.endpointIncomingHelloVote);

// Store hash
app.get('/api/hash', api.endpointStoreHash);

// General unauthorized for api
app.get('/api/unauthorized', function(req, res) {
  res.status(401);
  res.json({
    status: 'error',
    code: 401,
    message: 'Unauthorized'
  });
});

// Loader.io route
if (process.env.LOADERIO_VERIFY_TOKEN) {
  app.get('/' + process.env.LOADERIO_VERIFY_TOKEN, function(req, res) {
    res.send(process.env.LOADERIO_VERIFY_TOKEN);
  });
}

// General error handling
app.use(function errorHandler(error, req, res, next) {
  debug(error);

  if (res.headersSent) {
    return next(error);
  }

  if (process.env.NODE_ENV !== 'production') {
    res.json(error);
    debug(error);
    throw new Error(error);
  }
  else {
    res.status(500);
    res.render('error', {
      title: 'Error',
      error: error
    });
  }
});

// Function to use hash if available
function useHash(req, res, next) {
  var copy;
  if (req.session && req.session.hash) {
    copy = _.clone(req.session.hash);
    delete req.session.hash;
    res.redirect(req.path + '#' + copy);
  }
  else {
    next();
  }
}

// Export app
module.exports = app;
