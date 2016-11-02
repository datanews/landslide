/**
 * PassportJS and basic session auth management is not
 * working, so here are some helpful functions
 * to ensure identity.
 *
 * Allow for HTTP Auth backup
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const request = require('request');
const SlackStrategy = require('passport-slack').Strategy;
const BasicStrategy = require('passport-http').BasicStrategy;
const debug = require('debug')('slack');

// In memory storage of known good tokens to help make things a bit speedier,
// and a fake one for http auth requests if needed
var knownTokens = [
  'things-went-downhill',
  'and-keep-going-downhill'
];

// Get private users
var privateUsers = process.env.SLACK_USERS_PRIVATE.split(',');

// Get API keys
var apiKeys = process.env.API_KEYS.split(',');

// Test token
function testToken(token, done) {
  // Check known tokens
  if (token && ~knownTokens.indexOf(token)) {
    return done(null);
  }

  // This URL requires more access/scope than we need
  // https://slack.com/api/auth.test?token=
  request.get("https://slack.com/api/users.identity?token=" + token, function(error, response, body) {
    if (error || response.statusCode >= 300) {
      return done(error || response.statusCode);
    }

    var body = JSON.parse(body);
    if (body.ok !== true) {
      done(body);
    }
    else {
      knownTokens.push(token);
      done(null, body);
    }
  });
}

// Route middleware to make sure a user is logged in
function isLoggedIn(login, logout, redirect) {
  logout = logout || '/logout';
  login = login || '/login';

  return function(req, res, next) {
    // Check for API key first
    if (req.query.key && ~apiKeys.indexOf(req.query.key)) {      
      if (redirect) {
        res.redirect(redirect);
      }
      else {
        next();
      }
    }
    // Can't get passport to do its thing, so we look at the session
    // ourselves.
    else if (req.session && req.session.user && req.session.user.token && req.session.user.team === process.env.SLACK_TEAM) {
      testToken(req.session.user.token, function(error, response) {
        if (error) {
          res.redirect(logout);
        }
        else {
          if (redirect) {
            res.redirect(redirect);
          }
          else {
            next();
          }
        }
      });
    }
    else if (req.session && req.session.user && req.session.user.token && req.session.user.team !== process.env.SLACK_TEAM) {
      // TODO: Help message to say the team must be our team.  Slack authorize does not
      // enforce this for some reason.
      res.redirect(logout);
    }
    else {
      res.redirect(login);
    }
  }
}

// Slack strategy
var slackStrategy = new SlackStrategy({
  clientID: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  team: process.env.SLACK_TEAM,
  scope: 'identity.basic,identity.team,identity.avatar,identity.email',
  profileUrl: 'https://slack.com/api/users.identity?token=',
  extendedUserProfile: false,
  passReqToCallback: true
},
function(req, accessToken, refreshToken, profile, done) {
  var user = {
    id: profile._json.user.id,
    displayName: profile._json.user.name,
    email: profile._json.user.email,
    team: profile._json.team.id,
    teamName: profile._json.team.name,
    imageURL: profile._json.user.image_192,
    token: accessToken,
    refreshToken: refreshToken,
    _raw: profile._json,
    accessPrivate: false
  }

  // Check if user is in private group
  if (~privateUsers.indexOf(user.email)) {
    user.accessPrivate = true;
  }

  // Can't get passport to hold this information, so we manually do
  // it here.
  req.session.user = user;
  done(null, user);
});

// HTTP auth strategy
var httpStrategy = new BasicStrategy({
  passReqToCallback: true
},
function(req, username, password, done) {
  var user = {};
  var private = false;

  if ((username === process.env.HTTP_USER && password === process.env.HTTP_PASS) ||
    (username === process.env.HTTP_USER_PRIVATE && password === process.env.HTTP_PASS_PRIVATE)) {
    private = (username === process.env.HTTP_USER_PRIVATE && password === process.env.HTTP_PASS_PRIVATE);
    // This is follows a slack user object, so its easier
    // to switch out when needed.
    user = {
      id: 'landslider-id',
      displayName: private ? 'Avalanche' : 'Landslider',
      email: 'landslide@example.com',
      team: process.env.SLACK_TEAM,
      teamName: 'ElectionLand',
      imageURL: private ? '/media/noun_578479-strategy-red.png' : '/media/noun_578479-strategy-white.png',
      token: 'things-went-downhill',
      accessPrivate: private,
      http: true
    };

    req.session.user = user;
    done(null, user);
  }
  else {
    done(null, false);
  }
});


// Export
module.exports = {
  isLoggedIn: isLoggedIn,
  slackStrategy: slackStrategy,
  httpStrategy: httpStrategy
}
