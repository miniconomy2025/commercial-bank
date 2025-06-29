import app from './app';
import appConfig from './config/app.config';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    logger.info(`Server is running in ${appConfig.env} mode on port ${PORT}`);
});
