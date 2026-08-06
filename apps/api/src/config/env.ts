import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../../.env' });

type Env = {
  port: number;
  databaseUrl: string;
};

const required = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const env: Env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(process.env.DATABASE_URL, 'DATABASE_URL'),
};
