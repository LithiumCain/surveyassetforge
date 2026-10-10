import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Single shared Prisma client for the whole API (one DB connection pool).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// pg emits 'error' when an IDLE pooled client's connection dies, and an
// EventEmitter with no 'error' listener throws — taking the whole process down.
// Neon severs idle connections whenever it auto-suspends (~5 minutes without
// traffic), so on a quiet deployment this is routine, not rare. The pool drops
// the dead client on its own; the next query just opens a fresh connection.
pool.on('error', (err) => {
  console.error('[pg pool] idle client error (connection discarded):', err.message);
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
