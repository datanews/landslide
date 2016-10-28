/**
 * Main server.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const fs = require('fs');
const path = require('path');
const cache = require('apicache');
const express = require('express');
const passport = require('passport');
const favicon = require('serve-favicon');
const i18n = require('i18n');
const _ = require('lodash');
const debug = require('debug')('server');

const db = require('./db.js')();
const utils = require('./utils.js');
const slack = require('./slack.js');
const api = require('./api.js');

// Use Slack for auth
// See: https://api.slack.com/docs/sign-in-with-slack
passport.use('slack', slack.strategy);

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
app.use(require('express-session')({
  secret: process.env.SESSION_SECRET || 'this should probably be updated, eh',
  saveUninitialized: true,
  resave: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

// Persist language change via query param.  i18n expects
// language in cookie, though express-session handles
// it now.
app.use(function setLang(req, res, next) {
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
  return next();
});

// Default cache options
cache.options({
  defaultDuration: 1000 * 30,
  appendKey: ['session', 'user', 'accessPrivate'],
  statusCodes: { include: [ 200 ] }
});

// Slack auth routes
app.get('/auth/slack', passport.authorize('slack'));
app.get('/auth/slack/callback',
  passport.authorize('slack', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

// Login
app.get('/login', function(req, res, next) {
  res.render('login', {
    title: 'Login',
    user: req.user
  });
});

// Logout
app.get('/logout',
  slack.isLoggedIn(),
  function(req, res) {
    req.logout();
    req.session.destroy();
    res.redirect('/');
  });

// Main page
app.get('/',
  slack.isLoggedIn(),
  function(req, res) {
    res.render('home', {
      title: 'Home',
      user: req.session.user
    });
  });

// API endpoints.  Get reports
app.get('/api/reports',
  slack.isLoggedIn('/api/unauthorized'),
  cache.middleware(),
  api.endpointReports);

// Get report options (unique values for fields)
app.get('/api/reports/options',
  slack.isLoggedIn('/api/unauthorized'),
  cache.middleware(),
  api.endpointReportsOptions);

// Toggle inCheck flag
app.get('/api/reports/toggle-check',
  slack.isLoggedIn('/api/unauthorized'),
  api.endpointReportsToggleCheck);

// Set report data from hellow vote
app.post('/api/incoming/hello-vote',
  api.endpointIncomingHelloVote);

// General unauthorized for api
app.get('/api/unauthorized', function(req, res) {
  res.status(401);
  res.json({
    status: 'error',
    code: 401,
    message: 'Unauthorized'
  });
});

// General error handling
app.use(function errorHandler(error, req, res, next) {
  debug(error);

  if (res.headersSent) {
    return next(error);
  }

  if (process.env.NODE_ENV !== 'production') {
    res.json(error);
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

// Export app
module.exports = app;
