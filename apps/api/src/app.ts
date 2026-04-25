import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler.js';
import { assetRoutes } from './routes/assetRoutes.js';
import { assignmentRoutes } from './routes/assignmentRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { siteRoutes } from './routes/siteRoutes.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1', authRoutes);
app.use('/api/v1', siteRoutes);
app.use('/api/v1', assetRoutes);
app.use('/api/v1', assignmentRoutes);

app.use(errorHandler);

export default app;
