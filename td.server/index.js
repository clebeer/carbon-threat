var appFactory = require('./dist/app.js');

appFactory.default.create().then(function(app) {
    var server = app.listen(app.get('port'), function() {
        console.log('Express server listening at ' + server.address().address + ' on port ' +  server.address().port);
    });
}).catch(function(err) {
    console.error('Failed to start server:', err);
    process.exit(1);
});
