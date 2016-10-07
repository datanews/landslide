/**
 * Main client JS
 */

$(document).ready(function() {
  if ($('#home-template').length > 0) {
    reporting();
  }
});

// Render reporting
function reporting() {
  var template = $('#home-template').html();
  var el = '#home-template-container';
  var data = [];
  var ractive = new Ractive({
    el: el,
    template: template,
    data: {
      isLoading: true,
      data: data
    }
  });

  // Set up routing
  page('/', route)
  page('/set/:set', route)
  page('*', route)
  page({
    hashbang: true
  });

  // Do route
  function route(context, next) {
    updateData(context.params.set, function(error, data) {
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
        d.ElectionWait && d.ElectionWait.updatedM ? d.ElectionWait.updatedM : undefined;

      return d;
    });

    done(null, data);
  })
  .fail(done);
}
