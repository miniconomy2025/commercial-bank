import dotenv from 'dotenv';
dotenv.config();

const NODE_ENV = process.env.NODE_ENV;
dotenv.config({ path: `.env.${NODE_ENV}` });

if (!NODE_ENV) throw new Error('Missing required env: NODE_ENV');

if (!process.env.PORT) throw new Error('Missing required env: PORT');
if (!process.env.DATABASE_URL) throw new Error('Missing required env: DATABASE_URL');
// REMOVED: No mTLS for now
// if (!process.env.CA_CERT_PATH) throw new Error('Missing required env: CA_CERT_PATH');
// if (!process.env.SERVER_KEY_PATH) throw new Error('Missing required env: SERVER_KEY_PATH');
// if (!process.env.SERVER_CERT_PATH) throw new Error('Missing required env: SERVER_CERT_PATH');
if (!process.env.CLIENT_ID) throw new Error('Missing required env: CLIENT_ID');

const appConfig = {
  env: NODE_ENV,
  port: Number(process.env.PORT),
  dbUrl: process.env.DATABASE_URL,
  isDev: NODE_ENV === 'development',
  isProd: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  // REMOVED: No mTLS for now
  // caPath: process.env.CA_CERT_PATH,
  // keyPath: process.env.SERVER_KEY_PATH,
  // certPath: process.env.SERVER_CERT_PATH,
  timeout: process.env.TIMEOUT ? Number(process.env.TIMEOUT) : 60000,
  thohHost: process.env.THOH_HOST ?? 'https://ec2-13-244-65-62.af-south-1.compute.amazonaws.com',
  clientId: process.env.CLIENT_ID,
  thohTeamId: 'thoh',
  thohAccountNumber: '000000000000',
  fractionalReserve: process.env.FRACTIONAL_RESERVE ? Number(process.env.FRACTIONAL_RESERVE) : 0.2
};

export default appConfig;