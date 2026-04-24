import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler.js';
import { assetRoutes } from './routes/assetRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { siteRoutes } from './routes/siteRoutes.js';

export const prisma = new PrismaClient();

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

app.use(errorHandler);
