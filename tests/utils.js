/**
 * Test utils
 */

var test = require('tape');
var utils = require('../lib/utils.js');


test('utils, parseMinutes', function(t) {
  var parseTests = [
    ['', undefined],
    [null, undefined],
    [undefined, undefined],
    [[ 1 ], undefined],
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
    ['dos horas', 120]
  ];

  t.plan(parseTests.length);
  parseTests.forEach(function(p) {
    t.equal(utils.parseMinutes(p[0]), p[1]);
  });
});
