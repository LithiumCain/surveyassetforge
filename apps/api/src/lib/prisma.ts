import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the whole API (one DB connection pool).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
