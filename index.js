/**
 * Main server.
 */

// Configure
require('dotenv').config({ silent: true });

// New relic monitoring, useing environment variables
if (process.env.NEW_RELIC_NO_CONFIG_FILE && process.env.NEW_RELIC_APP_NAME) {
  require('newrelic');
}

// Dependencies
const server = require('./lib/server.js');
const debug = require('debug')('index');

// Listen
server.listen(process.env.PORT || 3000);
debug("Server start at //localhost:" + (process.env.PORT || 3000));
