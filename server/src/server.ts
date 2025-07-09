import app from './app';
import appConfig from './config/app.config';
import { logger } from './utils/logger';
import cors from 'cors'; // Add this line


const PORT = process.env.PORT;

app.use(cors())

app.listen(PORT, () => {
  logger.info(`Server is running in ${appConfig.env} mode on port ${PORT} (HTTP, no mTLS)`);
});