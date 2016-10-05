/**
 * Main server.
 */

// Dependencies
var express = require('express');
var passport = require('passport');
var SlackStrategy = require('passport-slack').Strategy;
require('dotenv').config({ silent: true });

// Use Slack for auth
passport.use(new SlackStrategy({
    clientID: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    scope: 'identity.basic',
    extendedUserProfile: false
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ SlackId: profile.id }, function (err, user) {
      return done(err, user);
    });
  }
));

// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({
  secret: process.env.SESSION_SECRET || 'this should probably be updated, eh',
  resave: false,
  saveUninitialized: false
}));

// Setup static files
app.use(express.static('static'));

// Routes
app.get('/auth/slack', passport.authorize('slack'));
app.get('/auth/slack/callback',
  passport.authorize('slack', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/logout',
  passport.authorize('slack', { failureRedirect: '/login' }),
  function(req, res) {
  req.session.destroy();
  req.logout();
  res.redirect('/');
});

app.get('/',
  passport.authorize('slack', { failureRedirect: '/login' }),
  function(req, res) {
  res.render('home', { user: req.user });
});

app.get('/login', function(req, res) {
  res.render('login', { user: req.user });
});

// Listen
app.listen(process.env.PORT || 3000);
console.log("Server start at //localhost:" + (process.env.PORT || 3000));
