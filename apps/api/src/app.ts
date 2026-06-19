import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { assetRoutes } from './routes/assetRoutes.js';
import { assignmentRoutes } from './routes/assignmentRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { siteRoutes } from './routes/siteRoutes.js';

// Re-export the shared client so existing imports keep working.
export { prisma } from './lib/prisma.js';

export const app = express();

// Behind Vercel's proxy — needed so req.ip is the real client IP (for audit).
app.set('trust proxy', 1);

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
