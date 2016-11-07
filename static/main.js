/**
 * Main client JS
 */

$(document).ready(function() {
  // Some settings
  moment.locale(window.template.locale || 'en');

  // Detect mobile
  $('body').toggleClass('mobile', isMobile());

  // Send hash to server on login page
  if (window.location.pathname === '/login') {
    storeHash();
    $(window).on('hashchange', storeHash);
  }

  // Reporting
  if ($('#home-template').length > 0) {
    reporting();
  }
});

// Render reporting
function reporting() {
  var dataPollingInterval = 30 * 1000;
  var template = $('#home-template').html();
  var el = '#home-template-container';
  var originalData = [];
  var muted = localLoad('muted');
  var multiselects = {};
  var mapInput;
  var defaultSearch = {
    q: {},
    sort: {
      field: 'updated',
      direction: -1
    },
    limit: 250
  };
  var ractive = new Ractive({
    el: el,
    template: template,
    data: {
      isLoading: true,
      filteredState: "",
      filteredSource: "",
      data: [],
      muted: muted,
      query: defaultSearch.q,
      sort: defaultSearch.sort,
      limit: defaultSearch.limit,
      path: window.location.pathname,
      _: _,
      moment: moment,
      JSURL: JSURL
    }
  });

  // Could not get any router to work with the JSURL syntax, and couldn't
  // get pushstate to work correctly either, so, we update hash and read on
  // load, allowing for linking
  function route(r) {
    window.location.hash = r ? '/' + r : '';
  }
  route.update = function(e) {
    if (window.location.hash.indexOf('search%2F') > 0) {
      window.location.hash = decodeURIComponent(window.location.hash);
    }
    var parts = window.location.hash.replace('#', '').split('/');

    if (parts[0] === 'search' || parts[1] === 'search') {
      ractive.set('search', JSURL.parse(window.location.hash.split('/').pop()));
    }
    else {
      ractive.set('search', defaultSearch);
    }
  }
  route.parse = function() {
    var search = ractive.get('search');
    if (!_.isObject(search)) {
      return;
    }

    var q = {};
    var s = {};

    if (search.q) {
      _.each(search.q, function(value, field) {
        if (field === '$or' && value[0].lat) {
          q.noLocation = true;
        }
        else if (field === '$text' && value && value.$search) {
          q.search = value.$search;
        }
        else {
          q[field] = field === 'inCheck' && value.$ne ? true :
            _.isObject(value) && value.$in ? value.$in :
            _.isObject(value) && value.$exists ? true : value;
        }
      });
      ractive.set('query', q);
    }

    if (search.sort) {
      _.each(search.sort, function(direction, field) {
        s.field = field;
        s.direction = direction;
      });
      if (s.field && s.direction) {
        ractive.set('sort', s);
      }
    }

    if (search.limit && parseInt(search.limit, 10)) {
      ractive.set('limit', parseInt(search.limit, 10));
    }
  }
  $(window).on('hashchange', route.update);
  if (window.location.hash) {
    route.update();
    route.parse();
  }

  // On search, update data
  ractive.observe('search', function(n, o) {
    if (throttledFetch) {
      throttledFetch();
    }
  });

  // Watch for query events for updating the multiselects
  ractive.observe('query.*', function(n, o, keypath) {
    var values = ractive.get(keypath);
    if (multiselects[keypath]) {
      $(multiselects[keypath]).multiselect('select', values);
    }
  });

  // Handle view updates.  Turn parts into URL.
  function observeSearchParts(n, o, keypath) {
    // Query
    var query = _.cloneDeep(ractive.get('query')) || {};
    var q = {};
    var fields = {};

    _.each(query, function(value, field) {
      if (field === 'search' && value) {
        q.$text = { $search: value };
        fields.searchScore = { $meta: 'textScore' };
        // sort: { score : { $meta : 'textScore' } }
      }
      else if (field === 'inCheck' && value) {
        q[field] = { $ne: true };
      }
      else if (_.isArray(value) && value.length) {
        q[field] = { $in: value };
      }
      else if (_.isBoolean(value) && value) {
        q[field] = { $exists: value, $nin: [ null, 0, '0' ] };
      }
      else if (!_.isArray(value) && _.isObject(value)) {
        q[field] = value;
      }
      else if (!_.isArray(value) && value) {
        q[field] = value;
      }
    });

    // Remove search
    if (keypath === 'search' && !query.search) {
      delete q.$text;
      delete fields.searchScore;
    }

    // No location means remove other location fields
    if (keypath === 'query.noLocation' && query.noLocation) {
      q = _.extend(q, {
        $or: [
          { lat: { $exists: false }},
          { lat: null }
        ]
      });
      delete q.state;
      delete q.lat;
      delete q.lon;
      delete q.address;
      delete q.noLocation;
    }
    else if (~['query.state', 'query.lat', 'query.lon', 'query.address'].indexOf(keypath) && query.noLocation) {
      ractive.set('query.noLocation', false);
      delete q.noLocation;
    }

    // If there is an ID, it should be coming from a link, so we
    // remove it now
    if (q.id) {
      delete q.id;
    }

    // Sort
    var sort = _.cloneDeep(ractive.get('sort'));
    var s = {};
    if (sort && sort.field) {
      s[sort.field] = !_.isNaN(parseInt(sort.direction, 10)) && parseInt(sort.direction, 10) === -1 ? -1 : 1;
    }
    else {
      s = { updated: -1 };
    }

    // Limit
    var limit = _.cloneDeep(ractive.get('limit'));

    route('search/' + JSURL.stringify({
      q: q,
      fields: fields,
      sort: s,
      limit: limit
    }));
  }
  ractive.observe('query.*', observeSearchParts, { init: false });
  ractive.observe('sort.*', observeSearchParts, { init: false });
  ractive.observe('limit', observeSearchParts, { init: false });

  // Observer muting to save to browser
  ractive.observe('muted.*', function(n, o, keypath) {
    if (n !== undefined) {
      localSave('muted', ractive.get('muted'));
    }
  }, { init: false });

  // Events
  ractive.on('toggleCheck', function(e, id) {
    var reportIndex = _.findIndex(ractive.get('data'), function(d) {
      return d.id === id;
    });

    if (window.confirm(window.template.strings.confirmInCheck)) {
      $.getJSON('/api/reports/toggle-check?id=' + id, function(updated) {
        ractive.set('data.' + reportIndex + '.inCheck', updated.inCheck);
      })
      .fail(function(error) {
        console.log(error);
      });
    }
  });

  ractive.on('toggle', function(e, prop) {
    this.toggle(e.keypath);
  });

  ractive.on('toggleAbsolute', function(e, prop) {
    this.toggle(prop);
  });

  ractive.on('resetSearch', function(e) {
    e.original.preventDefault();
    // This is the easiest
    window.location.href = window.location.pathname;
  });

  ractive.on('submitSearch', function(e) {
    // This just makes sure the form doesn't actually reload the
    // page without our consent
    e.original.preventDefault();
  });

  ractive.on('resetMapInput', function(e) {
    e.original.preventDefault();
    // Remove rectangle
    if (mapInput._currentRectangle) {
      mapInput._currentRectangle.setMap(null);
    }
    // Update view values
    ractive.set({
      'query.lat': undefined,
      'query.lon': undefined
    });
  });

  ractive.on('exportCSV', function(e, useFilters) {
    var params = ractive.get('search') || {};
    params.format = 'csv';

    if (!useFilters) {
      params = {
        limit: 0,
        format: 'csv'
      };
    }
    var uri = urlQuery('/api/reports/', params);
    var name = moment().format() + '-electionland-reporting.csv';

    // Hacky way to get a specific file name
    var link = document.createElement('a');
    link.className = 'hidden';
    link.href = uri;
    link.download = name;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Draw and handle map input
  function drawInputMap() {
    var currentRectangle;
    var query = ractive.get('query');
    var styles = {
      fillColor: '#FFFFFF',
      fillOpacity: 0.25,
      strokeColor: '#242424',
      strokeWeight: 4,
      editable: false
    };

    // Draw map
    mapInput = new google.maps.Map(document.getElementById('input-map'), {
      center: { lat: 39.5, lng: -98.35 },
      zoom: 3,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.TOP_LEFT
      },
      scrollwheel: false
    });

    // Draw rectangle if needed
    if (query.lat && query.lon) {
      currentRectangle = new google.maps.Rectangle(_.extend({}, styles, {
        map: mapInput,
        bounds: {
          north: parseFloat(query.lat.$lte),
          south: parseFloat(query.lat.$gte),
          east: parseFloat(query.lon.$lte),
          west: parseFloat(query.lon.$gte)
        }
      }));
    }

    // Drawing manager
    var drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_RIGHT,
        drawingModes: ['rectangle']
      },
      rectangleOptions: styles
    });
    drawingManager.setMap(mapInput);
    mapInput._drawing = drawingManager;
    mapInput._currentRectangle = currentRectangle;

    // Handle event
    google.maps.event.addListener(drawingManager, 'rectanglecomplete', function(rect) {
      if (currentRectangle) {
        currentRectangle.setMap(null);
      }

      // Tell ractive about the bounds
      var b = rect.getBounds();
      var ne = b.getNorthEast().toJSON();
      var sw = b.getSouthWest().toJSON();
      ractive.set({
        'query.lat': { $gte: sw.lat.toFixed(6), $lte: ne.lat.toFixed(6) },
        'query.lon': { $gte: sw.lng.toFixed(6), $lte: ne.lng.toFixed(6) }
      });

      // Keep track of rectangle
      currentRectangle = rect;
      mapInput._currentRectangle = currentRectangle;
    });
  }
  if (window.google) {
    drawInputMap();
  }

  // Get options
  function fetchOptions() {
    getOptions(function(error, options) {
      if (error) {
        return console.log(error);
      }

      _.each(options, function(set, o) {
        ractive.set('options.' + o, _.sortBy(_.filter(_.uniq(set))));
      });

      // Nice multiselect
      _.each([
        ['#query-state', 'query.state'],
        ['#query-source-name', 'query.sourceName']
      ], function(set) {
        var values = ractive.get(set[1]);

        // Rebuild if already there
        if ($(set[0]).hasClass('multiselected')) {
          $(set[0]).multiselect('rebuild');
        }
        else {
          $(set[0]).addClass('multiselected');
          $(set[0]).multiselect({
            disableIfEmpty: true,
            onChange: function(option, checked) {
              var selected = ractive.get(set[1]);
              if (!selected) {
                ractive.set(set[1], []);
                selected = ractive.get(set[1]);
              }

              var value = $(option).val();
              var index = selected.indexOf(value);

              if (checked) {
                selected.push(value);
              }
              else {
                index = selected.indexOf(value);
                if (~index) {
                  selected.splice(index, 1);
                }
              }
            }
          }).multiselect('select', values);
        }
      });
    });
  }
  var repeatOptions = window.setInterval(fetchOptions, dataPollingInterval * 10);
  fetchOptions();

  // Fetch
  function fetch() {
    ractive.set('isLoading', true);

    // Get stats
    getStats(function(error, data) {
      if (!error) {
        ractive.set('totalStats', data);
      }
      else {
        console.log(error);
      }
    });

    // Update data
    updateData(ractive.get('search'), function(error, data) {
      var current = ractive.get('data');
      var sort = ractive.get('sort');

      if (!error && _.isArray(data)) {
        ractive.set('isLoading', false);

        // Get stats
        ractive.set('stats', resultsStats(data));

        // This seems to actually not redraw as much for some reason.
        ractive.set('data', data);
      }
      else if (error && error.status === 401) {
        // Reload page
        document.location.reload();
      }
      else {
        console.log(error);
      }
    });
  }

  // Make sure it only happens once every X seconds.
  var throttledFetch = _.throttle(fetch, 3 * 1000);

  // Poll
  var repeat = window.setInterval(throttledFetch, dataPollingInterval);
  throttledFetch();
}

// Update data
function updateData(params, done) {
  url = urlQuery('/api/reports', params);

  $.getJSON(url, function(data) {
    // Some parsing
    data = data.map(function(d) {
      d.updatedM = d.updated ? moment.unix(d.updated) : undefined;
      return d;
    });

    done(null, data);
  })
  .fail(done);
}

// Get options (such as sources)
function getOptions(done) {
  $.getJSON('/api/reports/options?field=state', function(states) {
    $.getJSON('/api/reports/options?field=sourceName', function(sources) {
      done(null, {
        states: _.map(_.filter(states), function(s) {
          return {
            value: s,
            name: window.landslide.statesAbbr[s] ? window.landslide.statesAbbr[s] : s
          };
        }),
        sourceNames: _.map(sources, function(s) {
          return {
            value: s,
            name: s
          };
        })
      });
    }).fail(done);
  }).fail(done);
}

// Get stats (report-wide)
function getStats(done) {
  $.getJSON('/api/reports/stats', function(stats) {
    return done(null, {
      totalReports: stats.all[0].totalCount,
      totalWaitTime: stats.all[0].waitSum,
      minWaitTime: stats.all[0].waitMin,
      maxWaitTime: stats.all[0].waitMax,
      lastFetch: stats.all[0].lastFetch ? moment.unix(stats.all[0].lastFetch) : undefined,

      nonZeroWaitTotalReports: stats.wait[0].totalCount,
      nonZeroWaitWaitAverage: _.isNumber(stats.wait[0].waitAvg) ? stats.wait[0].waitAvg.toFixed(1) : undefined,

      withReportTotalReports: stats.reports[0].totalCount
    });
  }).fail(done);
}

// Make stats for results
function resultsStats(data) {
  var nonZeroWait = _.filter(data, 'waitMinutes');
  var withReport = _.filter(data, 'report');
  var sumMinutes = _.sumBy(data, 'waitMinutes');

  return {
    totalReports: data.length,
    totalWaitTime: sumMinutes,
    minWaitTime: _.minBy(nonZeroWait, 'waitMinutes'),
    maxWaitTime: _.maxBy(nonZeroWait, 'waitMinutes'),

    nonZeroWaitTotalReports: nonZeroWait.length,
    nonZeroWaitWaitAverage: nonZeroWait.length ? (sumMinutes / nonZeroWait.length).toFixed(1) : undefined,

    withReportTotalReports: withReport.length
  }
}

// Add query to URL
function urlQuery(url, params) {
  var char = '?';

  if (params) {
    _.each(params, function(p, n) {
      url += char + n + '=' + encodeURIComponent(_.isArray(p) || _.isObject(p) ? JSON.stringify(p) : p);
      char = '&';
    });
  }

  return url;
}

// Local storage wrappers
function localSave(key, value) {
  if (window.localStorage) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

function localLoad(key) {
  if (window.localStorage) {
    try {
      return JSON.parse(window.localStorage.getItem(key));
    }
    catch(e) {
      return undefined;
    }
  }
}

function localDelete(key) {
  if (window.localStorage) {
    window.localStorage.removeItem(key);
    return true;
  }
}

// Compare numbers
function compareNumbers(a, b) {
  a = !_.isNumber(a) ? -99999999 : a;
  b = !_.isNumber(b) ? -99999999 : b;

  return (a > b) ? 1 :
    (a < b) ? -1 : 0;
}

// Store hash
function storeHash() {
  if (window.location.hash) {
    $.getJSON('/api/hash?hash=' + window.location.hash.replace('#', ''), function() {
      // Saved
    }).fail(function(error) {
      console.log(error);
    });
  }
}

// Is mobile/phone
// From
function isMobile() {
  var a = navigator.userAgent || navigator.vendor || window.opera;
  return (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)));
}
