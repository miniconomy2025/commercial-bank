import app from './app';
import appConfig from './config/app.config';
import { logger } from './utils/logger';
import fs from 'fs';
import https from 'https';

const PORT = process.env.PORT;

const options = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  ca: fs.readFileSync('ca.crt'),
  requestCert: true,
  rejectUnauthorized: false
};

https.createServer(options, app).listen(PORT, () => {
  logger.info(`Server is running in ${appConfig.env} mode on port ${PORT} with mTLS`);
});

