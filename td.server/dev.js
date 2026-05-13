const appFactory = require('./src/app.js');
const loggerHelper = require('./src/helpers/logger.helper.js').default;

const logger = loggerHelper.get('dev.js');

const createServer = async () => {
    const app = await appFactory.default.create();
    const server = app.listen(app.get('port'), function() {
        logger.info('Development server listening at ' + server.address().address + ' on port ' + server.address().port);
    });
};

createServer();

process.once('SIGUSR2',
  function () {
    process.kill(process.pid, 'SIGUSR2');
  }
);
