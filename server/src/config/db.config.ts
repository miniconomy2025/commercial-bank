import pgPromise from 'pg-promise';
import appConfig from '../config/app.config';

const pgp = pgPromise();
const db = pgp(appConfig.dbUrl);

export default db;
