import app from './app';
import appConfig from './config/app.config';
import { logger } from './utils/logger';
import fs from 'fs';
import https from 'https';
import { rootCertificates } from 'tls';

const PORT = process.env.PORT;

const options = {
  key: fs.readFileSync(appConfig.keyPath!),
  cert: fs.readFileSync(appConfig.certPath!),
  ca: [
    ...rootCertificates,
    fs.readFileSync(appConfig.caPath!),
  ],
  requestCert: true,
  rejectUnauthorized: true
};

if (appConfig.isProd) {
  https.createServer(options, app).listen(PORT, () => {
    logger.info(`Server is running in ${appConfig.env} mode on port ${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    logger.info(`Server is running in ${appConfig.env} mode on port ${PORT}`);
  });
}


