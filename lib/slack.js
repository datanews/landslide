/**
 * PassportJS and basic session auth management is not
 * working, so here are some helpful functions
 * to ensure identity.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const request = require('request');
const SlackStrategy = require('passport-slack').Strategy;

// Test token
function testToken(token, done) {
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
      done(null, body);
    }
  });
}

// Route middleware to make sure a user is logged in
function isLoggedIn(login, logout) {
  logout = logout || '/logout';
  login = login || '/login';

  return function(req, res, next) {
    // Can't get passport to do its thing, so we look at the session
    // ourselves.
    if (req.session && req.session.user && req.session.user.token && req.session.user.team === process.env.SLACK_TEAM) {
      testToken(req.session.user.token, function(error, response) {
        if (error) {
          res.redirect(logout);
        }
        else {
          next();
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

// Stategy
var strategy = new SlackStrategy({
  clientID: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  team: process.env.SLACK_TEAM,
  scope: 'identity.basic',
  profileUrl: 'https://slack.com/api/users.identity?token=',
  extendedUserProfile: false,
  passReqToCallback: true
},
function(req, accessToken, refreshToken, profile, done) {
  var user = {
    id: profile.displayName.id,
    displayName: profile.displayName.name,
    team: profile._json.team.id,
    token: accessToken,
    refreshToken: refreshToken,
    _raw: profile._json
  }

  // Can't get passport to hold this information, so we manually do
  // it here.
  req.session.user = user;
  done(null, user);
});


// Export
module.exports = {
  isLoggedIn: isLoggedIn,
  strategy: strategy
}
