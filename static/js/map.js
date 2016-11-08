/**
 * Map JS
 */

$(document).ready(function() {
  if ($('#full-map').length) {
    drawMap();
  }
});

// Draw map
function drawMap() {
  var map = new google.maps.Map(document.getElementById('full-map'), {
    center: { lat: 39.5, lng: -98.35 },
    zoom: 4
  });
  var markers = [];
  var markerCluster;
  var since = 2;

  // Get data and update map
  function getDataUpdateMap() {
    $('.map-info').addClass('is-loading');

    getData(since, function(error, data) {
      $('.map-info').removeClass('is-loading');

      if (markerCluster) {
        _.each(markers, function(m) {
          markerCluster.removeMarker(m);
          m.setMap(null);
        });
        markers = [];
      }

      _.each(data, function(d) {
        var text = d.waitTimes && d.waitTimes.length ? Math.round(_.mean(d.waitTimes)).toString() + 'm' : '';
        var image =  'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2238%22%20height%3D%2238%22%20viewBox%3D%220%200%2038%2038%22%3E%3Cpath%20fill%3D%22%23808080%22%20stroke%3D%22%23ccc%22%20stroke-width%3D%22.5%22%20d%3D%22M34.305%2016.234c0%208.83-15.148%2019.158-15.148%2019.158S3.507%2025.065%203.507%2016.1c0-8.505%206.894-14.304%2015.4-14.304%208.504%200%2015.398%205.933%2015.398%2014.438z%22%2F%3E%3Ctext%20transform%3D%22translate%2819%2018.5%29%22%20fill%3D%22%23fff%22%20style%3D%22font-family%3A%20Arial%2C%20sans-serif%3Bfont-weight%3Abold%3Btext-align%3Acenter%3B%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%3E' + text  + '%3C%2Ftext%3E%3C%2Fsvg%3E';

        markers.push(new google.maps.Marker({
          icon: image,
          position: { lat: d.lat, lng: d.lon },
          title: 'Wait time reports: ' + d.waitTimes.length
        }));
      });

      if (!markerCluster) {
        markerCluster = new MarkerClusterer(map, markers, {
          imagePath: '/media/markers/m'
        });
      }
      else {
        markerCluster.addMarkers(markers);
        markerCluster.redraw();
      }
    });
  }

  var throttledGetDataUpdateMap = _.throttle(getDataUpdateMap, 2 * 1000);
  setInterval(getDataUpdateMap, 60 * 1000);
  getDataUpdateMap();

  $('#since-amount').on('change', function(e) {
    since = $('#since-amount').val() ? parseFloat($('#since-amount').val()) : 2;
    throttledGetDataUpdateMap();
  });
}

// Get data
function getData(since, done) {
  var since = moment().subtract(since, 'hours').startOf('minute').unix();

  $.getJSON('/api/reports/geo?since=' + since, function(data) {
    done(null, data);
  })
  .fail(function(error) {
    console.log(error);
  });
}
