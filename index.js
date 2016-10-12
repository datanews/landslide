/**
 * Main server.
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const util = require('util');
const express = require('express');
const passport = require('passport');
const i18n = require('i18n');
const _ = require('lodash');
const slack = require('./lib/slack.js');
require('dotenv').config({ silent: true });

// Use Slack for auth
// See: https://api.slack.com/docs/sign-in-with-slack
passport.use('slack', slack.strategy);

// Create a new Express application.
const app = express();

// Configure view engine to render EJS templates.
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs');

// Setup static files
const cacheAge = process.env.NODE_ENV === 'production' ? 1000 * 60 * 60 * 24 : undefined;
app.use(express.static(path.join(__dirname, 'static'), { maxAge: cacheAge }));

// i18n
i18n.configure({
  locales: ['en', 'es'],
  defaultLocale: 'en',
  directory: path.join(__dirname, '/locales'),
  cookie: 'language',
  queryParameter: 'lang',
  updateFiles: false
});

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
//app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
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

  console.log(i18n.getLocale());
  console.log(i18n.__('siteTitle'));
  return next();
});

// Slack auth routes
app.get('/auth/slack', passport.authorize('slack'));
app.get('/auth/slack/callback',
  passport.authorize('slack', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
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
  slack.isLoggedIn,
  function(req, res) {
    req.logout();
    req.session.destroy();
    res.redirect('/');
  });

// Main page
app.get('/',
  slack.isLoggedIn,
  function(req, res) {
    res.render('home', {
      title: 'Home',
      user: req.session.user
    });
  });

// "API"
app.get('/api',
  slack.isLoggedIn,
  function(req, res) {
    const set = req.query.set || 'all';
    const setPath = path.join(__dirname, 'data', 'collected', set + '.json');

    if (fs.existsSync(setPath)) {
      res.json(JSON.parse(fs.readFileSync(setPath, "utf-8")));
    }
    else {
      res.status(404);
      res.json({
        status: 'error',
        statusCode: 404,
        message: 'Unable to find set.'
      });
    }
  });


// General error handling
app.use(function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV !== 'production') {
    res.json(err);
    throw new Error(err);
  }
  else {
    res.status(500);
    res.render('error', {
      title: 'Error',
      error: err
    });
  }
});

// Listen
app.listen(process.env.PORT || 3000);
console.log("Server start at //localhost:" + (process.env.PORT || 3000));
