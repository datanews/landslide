/**
 * Main server.
 */

// Configure
require('dotenv').config({ silent: true });

// Dependencies
const server = require('./lib/server.js');
const debug = require('debug')('index');

// Listen
server.listen(process.env.PORT || 3000);
debug("Server start at //localhost:" + (process.env.PORT || 3000));
