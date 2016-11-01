/**
 * Main client JS
 */

$(document).ready(function() {
  // Some settings
  moment.locale(window.template.locale || 'en');

  // Detect mobile
  $('body').toggleClass('mobile', isMobile());

  // Reporting
  if ($('#home-template').length > 0) {
    reporting();
  }
});

// Render reporting
function reporting() {
  var template = $('#home-template').html();
  var el = '#home-template-container';
  var originalData = [];
  var muted = localLoad('muted');
  var multiselects = {};
  var ractive = new Ractive({
    el: el,
    template: template,
    data: {
      isLoading: true,
      filteredState: "",
      filteredSource: "",
      data: [],
      muted: muted,
      _: _,
      moment: moment,
      query: {},
      sort: {
        field: 'updated',
        direction: -1
      },
      limit: 250
    }
  });

  // Custom "router" because can't get router to work with unusal, but
  // standard characters
  function route(r) {
    window.location.hash = r;
  }
  route.update = function(e) {
    var parts = window.location.hash.replace('#', '').split('/');

    if (parts[0] === 'search') {
      ractive.set('search', JSURL.parse(window.location.hash.split('/').pop()));
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
        q[field] = _.isObject(value) && value.$in ? value.$in :
          _.isObject(value) && value.$exists ? true : value;
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
  function observeSearchParts(n, o) {
    // Query
    var query = _.cloneDeep(ractive.get('query')) || {};
    var q = {};

    _.each(query, function(value, field) {
      if (_.isArray(value) && value.length) {
        q[field] = { $in: value };
      }
      else if (_.isBoolean(value) && value) {
        q[field] = { $exists: value, $nin: null };
      }
      else if (!_.isArray(value) && value) {
        q[field] = value;
      }
    });

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
      sort: s,
      limit: limit
    }));
  }
  ractive.observe('query', observeSearchParts, { init: false });
  ractive.observe('sort', observeSearchParts, { init: false });
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

  // Get options
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
    });
  });

  // Fetch
  function fetch() {
    ractive.set('isLoading', true);

    updateData(ractive.get('search'), function(error, data) {
      var current = ractive.get('data');
      var sort = ractive.get('sort');

      if (!error && data && data.length) {
        ractive.set('lastFetch', moment.unix(_.maxBy(data, 'fetched').fetched));
        ractive.set('isLoading', false);

        if (current) {
          ractive.merge('data', data, 'id');
          data.sort(function(a, b) {
            a = a[sort.field];
            b = b[sort.field];
            return _.isString(a) ? a.localeCompare(b) : a - b;
          });
          if (sort.direction === -1) {
            data.reverse();
          }
        }
        else {
          ractive.set('data', data);
        }
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
  var repeat = window.setInterval(throttledFetch, 30 * 1000);
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
        states: states,
        sourceNames: sources
      });
    }).fail(done);
  }).fail(done);
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

// Is mobile/phone
// From
function isMobile() {
  var a = navigator.userAgent || navigator.vendor || window.opera;
  return (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)));
}
