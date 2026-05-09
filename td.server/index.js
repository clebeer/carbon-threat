var appFactory = require('./dist/app.js');
var logger = require('./dist/helpers/logger.helper.js').default.get('index.js');

appFactory.default.create().then(function(app) {
    var server = app.listen(app.get('port'), function() {
        logger.info('Express server listening at ' + server.address().address + ' on port ' + server.address().port);
    });
}).catch(function(err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
