/**
 * Managing sessions.  In production, we use Redis
 * so that we can scale horizontally (multiple servers).
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const expressSession = require('express-session');
const RedisStore = require('connect-redis')(expressSession);
const debug = require('debug')('session');

// Middleware
module.exports = function() {
  var options = {
    secret: process.env.SESSION_SECRET || 'this should probably be updated, eh',
    saveUninitialized: true,
    resave: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 14
    }
  };

  // Use redis if URL
  if (process.env.REDIS_URL) {
    options.store = new RedisStore({ url: process.env.REDIS_URL });
  }

  return expressSession(options);
}
