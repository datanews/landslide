/**
 * Main client JS
 */

$(document).ready(function() {
  // Some settings
  moment.locale(window.template.locale || 'en');

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
  var ractive = new Ractive({
    el: el,
    template: template,
    data: {
      isLoading: true,
      data: []
    }
  });

  // Set up routing
  var router = Router({
    '/state/:filteredState': route,
    '*': route
  });
  router.init();

  // Do route
  function route(filteredState) {
    ractive.set('filteredState', filteredState ? filteredState : undefined);
  }

  // Handle view updates
  ractive.observe('filteredState', function(n, o) {
    if (n && n !== o) {
      router.setRoute('/state/' + n);
    }
  });

  // Fetch
  function fetch() {
    ractive.set('isLoading', true);

    updateData('all', function(error, data) {
      originalData = _.cloneDeep(data);

      if (!error) {
        ractive.set('lastFetch', data[0] ? moment.unix(data[0].lastFetch) : undefined);
        ractive.set('isLoading', false);
        ractive.set('data', data);
        ractive.set('states', _.sortBy(_.uniq(_.map(data, 'state'))));
      }
      else {
        console.log(error);
      }
    });
  }

  // Poll
  var repeat = window.setInterval(fetch, 30 * 1000);
  fetch();
}

// Update data
function updateData(set, done) {
  set = set || 'all';
  $.getJSON('/api?set=' + set, function(data) {
    // Some parsing
    data = data.map(function(d) {
      ['ElectionReport', 'ElectionWait'].forEach(function(p) {
        if (d[p]) {
          d[p].updatedM = moment(d[p].updated);
        }
      });

      // Newer date
      d.updatedM = d.ElectionReport && d.ElectionWait && d.ElectionReport.updatedM.isAfter(d.ElectionWait.updatedM) ?
        d.ElectionReport.updatedM :
        d.ElectionReport && d.ElectionWait && d.ElectionReport.updatedM.isBefore(d.ElectionWait.updatedM) ?
        d.ElectionWait.updatedM :
        d.ElectionReport && !d.ElectionWait ?
        d.ElectionReport.updatedM  :
        !d.ElectionReport && d.ElectionWait ?
        d.ElectionWait.updatedM : undefined;

      return d;
    });
    data = _.sortBy(data, function(d) {
      return d.updatedM ? d.updatedM.unix() : 0;
    }).reverse();

    done(null, data);
  })
  .fail(done);
}
