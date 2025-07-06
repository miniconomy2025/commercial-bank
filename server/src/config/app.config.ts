import dotenv from 'dotenv';
dotenv.config();

const NODE_ENV = process.env.NODE_ENV;
dotenv.config({ path: `.env.${NODE_ENV}` });

if (!NODE_ENV) throw new Error('Missing required env: NODE_ENV');

if (!process.env.PORT) throw new Error('Missing required env: PORT');
if (!process.env.DATABASE_URL) throw new Error('Missing required env: DATABASE_URL');
if (!process.env.CA_CERT_PATH) throw new Error('Missing required env: CA_CERT_PATH');
if (!process.env.SERVER_KEY_PATH) throw new Error('Missing required env: SERVER_KEY_PATH');
if (!process.env.SERVER_CERT_PATH) throw new Error('Missing required env: SERVER_CERT_PATH');

const appConfig = {
  env: NODE_ENV,
  port: Number(process.env.PORT),
  dbUrl: process.env.DATABASE_URL,
  isDev: NODE_ENV === 'development',
  isProd: NODE_ENV === 'production',
  caPath: process.env.CA_CERT_PATH,
  keyPath: process.env.SERVER_KEY_PATH,
  certPath: process.env.SERVER_CERT_PATH,
  timeout: process.env.TIMEOUT ? Number(process.env.TIMEOUT) : 60000,
  thohHost: process.env.THOH_HOST || 'https://localhost:8443',
};

export default appConfig;