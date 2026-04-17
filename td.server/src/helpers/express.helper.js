import express from 'express';
import helmet from 'helmet';

/**
 * Gets an instance of an express server
 * @returns {express}
 */
const getInstance = () => {
  const app = express();
  app.use(helmet());
  return app;
};

export default {
    getInstance
};
