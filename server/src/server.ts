import app from './app';
import appConfig from './config/app.config';
import { logger } from './utils/logger';
import fs from 'fs';
import https from 'https';
import http from 'http';
// import { rootCertificates } from 'tls';

const PORT = process.env.PORT;

// Use HTTP for test environment, HTTPS for others
if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
  http.createServer(app).listen(PORT, () => {
    logger.info(`Server is running in ${appConfig.env} mode on port ${PORT} (HTTP)`);
  });
} else {
  const certPath = `/home/ec2-user/certs/`;
  const options = {
    // REMOVED: No mTLS for now
    // key: fs.readFileSync(appConfig.keyPath!),
    // cert: fs.readFileSync(appConfig.certPath!),
    // ca: [
    //   ...rootCertificates,
    //   fs.readFileSync(appConfig.caPath!),
    // ],
    // requestCert: true,
    // rejectUnauthorized: true
      key: fs.readFileSync(`${certPath}/privkey.pem`),
      cert: fs.readFileSync(`${certPath}/fullchain.pem`)
  };

  https.createServer(options, app).listen(PORT, () => {
    logger.info(`Server is running in ${appConfig.env} mode on port ${PORT} (HTTPS)`);
  });
}


