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
  var ractive = new Ractive({
    el: el,
    template: template,
    data: {
      isLoading: true,
      filteredState: "",
      filteredOptIn: "",
      data: []
    }
  });

  // Set up routing
  var router = Router({
    '/state/:filteredState': route,
    '/opt-in/:filteredOptIn': route,
    '*': route
  });
  router.init();

  // Do route
  function route(filter) {
    var path = this.explode();

    if (path[0] === 'state') {
      ractive.set('filteredState', filter);
    }
    else if (path[0] === 'opt-in') {
      ractive.set('filteredOptIn', filter);
    }
  }

  // Handle view updates
  function observeFilter(name) {
    var path = name === 'filteredState' ? '/state/' : '/opt-in/';

    return function(n, o) {
      if (n !== o) {
        ractive.set(name === 'filteredState' ? 'filteredOptIn' : 'filteredState', "");
        router.setRoute(n ? path + n : '/');
      }
    }
  }
  ractive.observe('filteredState', observeFilter('filteredState'), { init: false });
  ractive.observe('filteredOptIn', observeFilter('filteredOptIn'), { init: false });

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
        ractive.set('optIns', _.sortBy(_.uniq(_.map(data, 'optIn'))));
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


// Is mobile/phone
// From
function isMobile() {
  var a = navigator.userAgent || navigator.vendor || window.opera;
  return (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)));
}
