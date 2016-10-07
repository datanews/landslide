/**
 * Generate some data for testing.
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const faker = require('faker');
const _ = require('lodash');
const moment = require('moment-timezone');

// Make test data
var test = [];

_.range(1000).forEach(function() {
  var t = {};
  t.phone = faker.phone.phoneNumber();
  t.canContact = faker.random.boolean();
  t.city = faker.address.city();
  t.zip = faker.address.zipCode();
  t.state = faker.address.stateAbbr();

  if (faker.random.boolean()) {
    t.ElectionWait = {
      value: faker.random.arrayElement(["30 min", "2minutes", "an hour"]),
      updated: faker.date.recent()
    }
  }

  if (faker.random.boolean()) {
    t.ElectionReport = {
      value: faker.lorem.words(),
      updated: faker.date.recent()
    }
  }

  t.lastFetch = moment().unix();

  test.push(t);
});

fs.writeFileSync(path.join(__dirname, 'collected', 'all.json'), JSON.stringify(test));
