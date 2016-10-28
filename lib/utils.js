/**
 * Some utility functions.
 */

// Dependencies
const _ = require('lodash');


// Make an id/slug
function id(input) {
  try {
    input = ('' + input).toLowerCase();
    input = input.replace(/\W+/g, ' ').trim().replace(/\s+/g, '-');
    return input;
  }
  catch(e) {
    return '';
  }
}

// An extra falsey check
function falsey(input) {
  const stringFalses = ['null', 'undefined', 'none', 'no', '0', '(no subject)'];

  if (!input) {
    return true;
  }
  else if (_.isNaN(input)) {
    return true;
  }
  else if (_.isString(input) && ~stringFalses.indexOf(input.toLowerCase().trim())) {
    return true;
  }
  else if (_.isString(input) && !input.trim()) {
    return true;
  }
  else {
    return false;
  }
}

// Cast into false (if false, return undefined)
function filterFalsey(input) {
  return falsey(input) ? undefined : input;
}

// Parse boolean from a string (text message)
function parseBooleanFromString(input) {
  if (_.isBoolean(input)) {
    return input;
  }

  try {
    input = ('' + input).toLowerCase();
    return (input === 'true' || input === 'yes' || input === 'y' || input === 'si' || input === 'sí' || input === true);
  }
  catch(e) {
    return false;
  }
}

// Parse text to minutes (crudely)
function parseMinutes(input) {
  var units = 'minutes';
  var amount;

  // Double check
  if (_.isNumber(input) && input > 0) {
    return input;
  }
  if (!input || !_.isString(input)) {
    return undefined;
  }

  // Determine units
  if (/(hour|hrs|hr|hora|[0-9]+\s*h($|\s|\.))/gi.test(input)) {
    units = 'hours';
  }

  // Look for written numbers
  _.each({
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7,
    'eight': 8, 'nine': 9, 'ten': 10, 'few': 3, 'couple': 2, 'quarter': 0.25, 'half': 0.5,
    'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7,
    'ocho': 8, 'nueve': 9, 'diez': 10, 'pocas': 3, 'par': 2, 'curato': 0.25, 'media': 0.5
  }, function(a, word) {
    if (~input.indexOf(word)) {
      amount = a;
    }
  });

  // Look for singular
  if (!amount) {
    if (/un\s*min|a\s*min|an\s*ho|una\s*ho/gi.test(input)) {
      amount = 1;
    }
  }

  // Otherwise numbers
  if (!amount) {
    amount = parseFloat(input.replace(/[^0-9.]/g, ''));
  }

  return !amount || _.isNaN(amount) ? undefined :
    units === 'hours' ? amount * 60 : amount;
}

// Make address from report object
function makeAddress(report) {
  var output = '';

  if (!report || !_.isObject(report)) {
    return undefined;
  }

  output = _.filter([report.address, report.city, report.county, report.state]).join(', ');
  output += report.zip ? ' ' + report.zip : '';

  return output.replace(/\s+/g, ' ').trim();
}

// Add county name if needed
function countyName(input) {
  input = filterFalsey(input);
  if (!input || !_.isString(input)) {
    return input;
  }

  var hasName = false;
  _.each(['county', 'parish', 'canton', 'borough'], function(n) {
    hasName = ~input.toLowerCase().indexOf(n) ? true : hasName;
  });

  return hasName ? input : input + ' County';
}

// List of states
const statesAbbr = {
    'AL': 'Alabama',
    'AK': 'Alaska',
    'AS': 'American Samoa',
    'AZ': 'Arizona',
    'AR': 'Arkansas',
    'CA': 'California',
    'CO': 'Colorado',
    'CT': 'Connecticut',
    'DE': 'Delaware',
    'DC': 'District Of Columbia',
    'FM': 'Federated States Of Micronesia',
    'FL': 'Florida',
    'GA': 'Georgia',
    'GU': 'Guam',
    'HI': 'Hawaii',
    'ID': 'Idaho',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'KY': 'Kentucky',
    'LA': 'Louisiana',
    'ME': 'Maine',
    'MH': 'Marshall Islands',
    'MD': 'Maryland',
    'MA': 'Massachusetts',
    'MI': 'Michigan',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'NE': 'Nebraska',
    'NV': 'Nevada',
    'NH': 'New Hampshire',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NY': 'New York',
    'NC': 'North Carolina',
    'ND': 'North Dakota',
    'MP': 'Northern Mariana Islands',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'PW': 'Palau',
    'PA': 'Pennsylvania',
    'PR': 'Puerto Rico',
    'RI': 'Rhode Island',
    'SC': 'South Carolina',
    'SD': 'South Dakota',
    'TN': 'Tennessee',
    'TX': 'Texas',
    'UT': 'Utah',
    'VT': 'Vermont',
    'VI': 'Virgin Islands',
    'VA': 'Virginia',
    'WA': 'Washington',
    'WV': 'West Virginia',
    'WI': 'Wisconsin',
    'WY': 'Wyoming'
  };


module.exports = {
  id: id,
  falsey: falsey,
  filterFalsey: filterFalsey,
  parseBooleanFromString: parseBooleanFromString,
  parseMinutes: parseMinutes,
  makeAddress: makeAddress,
  countyName: countyName,
  statesAbbr: statesAbbr,
  statesNames: _.invert(statesAbbr)
};
