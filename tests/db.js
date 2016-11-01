/**
 * Test API enpoints
 */

// Dependencies
const test = require('tape');
const db = require('../lib/db.js')();

// Disconnect DB when finished
test.onFinish(function() {
  db.disconnect();
});

// Test updateReport
test('db | updateReport', function(t) {
  var id = 'test-updateReport';
  var existing = {
    id: id,
    messages: [
      { id: '1111', timestamp: 1111 },
      { id: '2222', timestamp: 2222 }
    ]
  };
  var update = {
    id: id,
    messages: [
      { id: '3333', timestamp: 3333 },
      { id: '4444', timestamp: 0 }
    ]
  };

  // Remove existing
  db.models.Report.remove({ id: id }, function(error) {
    t.error(error);

    // Save first report
    var existingReport = new db.models.Report(existing);
    existingReport.save(function(error) {
      t.error(error);

      // Update
      db.updateReport(update, function(error, updateReport) {
        t.error(error);
        t.equal(updateReport.id, id, 'ID should match.');
        t.equal(updateReport.messages.length, 4, 'Enough messages.');
        t.equal(updateReport.messages[0].id, '3333', 'Ordered correctly.');
        t.end();
      })
    });
  });
});
