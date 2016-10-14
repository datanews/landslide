/**
 * Test generator
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const faker = require('faker');
const _ = require('lodash');
const moment = require('moment-timezone');
const utils = require('../lib/utils.js');
require('dotenv').config({ silent: true });

// Default timezone
moment.tz.setDefault('America/New_York');

// Data
var generated = [];
var fetched = moment().unix();

// Only for test, just in case
if (process.env.TEST) {
  // Generate
  _.range(faker.random.number({ min: 500, max: 1000 })).forEach(function() {
    var t = {};

    faker.locale = 'en';
    if (Math.random() > 0.75) {
      faker.locale = 'es';
    }

    t.id = 'test-' + faker.random.number(1000);
    t.source = 'test';
    //t.subSource = 'test';
    t.phone = faker.phone.phoneNumber();
    t.city = faker.address.city();
    t.state = faker.address.stateAbbr();
    t.zip = faker.address.zipCode();
    t.lat = faker.address.latitude();
    t.lon = faker.address.longitude();
    t.contactable = faker.random.boolean();

    if (Math.random() < 0.75) {
      t.wait = faker.random.arrayElement(['30 min', '2minutes', 'an hour']);
    }
    if (Math.random() < 0.75) {
      t.report = faker.lorem.words();
    }

    t.updated = moment.utc(faker.date.recent()).unix();
    t.fetched = fetched;

    if (Math.random() < 0.75) {
      t.inCheck = true;
    }

    //t.messages = [];

    generated.push(t);
  });
}

// Export
module.exports = function(done) {
  done(null, generated);
}
