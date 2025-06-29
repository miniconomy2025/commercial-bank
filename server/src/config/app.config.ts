import dotenv from 'dotenv';

const NODE_ENV = process.env.NODE_ENV;

if (!NODE_ENV) throw new Error('Missing required env: NODE_ENV');

dotenv.config({ path: `.env.${NODE_ENV}` });

if (!process.env.PORT) throw new Error('Missing required env: PORT');
if (!process.env.DATABASE_URL) throw new Error('Missing required env: DATABASE_URL');

const appConfig = {
  env: NODE_ENV,
  port: Number(process.env.PORT),
  dbUrl: process.env.DATABASE_URL,
  apiKey: process.env.API_KEY,
  isDev: NODE_ENV === 'development',
  isProd: NODE_ENV === 'production',
};

export default appConfig;