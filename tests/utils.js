/**
 * Test utils
 */

const test = require('tape');
const utils = require('../lib/utils.js');

// Tests for parseMinutes function
test('utils | parseMinutes', function(t) {
  var parseTests = [
    ['', undefined],
    [null, undefined],
    [undefined, undefined],
    [[ 1 ], undefined],
    [0, undefined],
    ['0', undefined],
    ['this doesnt say anything about time', undefined],

    [2, 2],
    [10.5, 10.5],
    [1000, 1000],

    ['2', 2],
    ['10.5', 10.5],
    ['ten', 10],

    ['1 minute', 1],
    ['3 minutes', 3],
    ['20 minutes', 20],
    ['30 minutes', 30],
    ['1 hour', 60],
    ['2 hours', 120],
    ['2min', 2],
    ['2minutes', 2],
    ['couple minutes', 2],
    ['a few minutes', 3],
    ['it took like 5 hours', 5 * 60],
    ['an hour', 60],
    ['3hr', 3 * 60],
    ['4.5hrs', 4.5 * 60],
    ['2h', 2 * 60],
    ['2 h.', 2 * 60],
    ['2h.', 2 * 60],

    ['1 minuto', 1],
    ['3 minutos', 3],
    ['20 minutos', 20],
    ['30 minutos', 30],
    ['1 hora', 60],
    ['2 horas', 120],
    ['2m', 2],
    ['2minutos', 2],
    ['par minutos', 2],
    ['pocas minutos', 3],
    ['an hora', 60],
    ['dos horas', 120],

    ['15 hours', undefined],
    ['123456', undefined]
  ];

  t.plan(parseTests.length);
  parseTests.forEach(function(p) {
    t.equal(utils.parseMinutes(p[0]), p[1]);
  });
});

// Falsey test
test('utils | falsey', function(t) {
  var parseTests = [
    ['', true],
    [null, true],
    [undefined, true],
    ['  undefined', true],
    ['0', true],
    ['null', true],
    ['None', true],
    ['none', true],
    ['     ', true],
    [-0, true],
    [0, true],
    [123, false],
    ['Not false', false],
    [true, false],
    [{ thing: true }, false],
    [[1, 2], false]
  ];

  t.plan(parseTests.length);
  parseTests.forEach(function(p) {
    t.equal(utils.falsey(p[0]), p[1]);
  });
});

// filterFalsey test
test('utils | filterFalsey', function(t) {
  var parseTests = [
    ['', undefined],
    [null, undefined],
    [undefined, undefined],
    ['  undefined', undefined],
    ['(no subject)', undefined],
    ['no', undefined],
    ['0', undefined],
    ['null', undefined],
    ['none', undefined],
    ['None', undefined],
    ['None.', undefined],
    ['     ', undefined],
    [-0, undefined],
    [0, undefined],
    [123, 123],
    ['Not false', 'Not false'],
    [true, true],
    [{ thing: true }, { thing: true }],
    [[1, 2], [1, 2]]
  ];

  t.plan(parseTests.length);
  parseTests.forEach(function(p) {
    t.deepEqual(utils.filterFalsey(p[0]), p[1]);
  });
});

// countyName test
test('utils | countyName', function(t) {
  var parseTests = [
    ['', undefined],
    [123, 123],
    ['Example', 'Example County'],
    ['example', 'example County'],
    ['123 Parish', '123 Parish']
  ];

  t.plan(parseTests.length);
  parseTests.forEach(function(p) {
    t.equal(utils.countyName(p[0]), p[1]);
  });
});

// parseBooleanFromString
test('utils | parseBooleanFromString', function(t) {
  var parseTests = [
    [true, true],
    [false, false],
    ['Yes', true],
    ['YES...', true],
    ['(si))...', true],
    [[], false],
    [undefined, false],
    [null, false],
    [{}, false],
    ['{}', false],
    ['sí', true],
    ['non', false]
  ];

  t.plan(parseTests.length);
  parseTests.forEach(function(p) {
    t.equal(utils.parseBooleanFromString(p[0]), p[1]);
  });
});
