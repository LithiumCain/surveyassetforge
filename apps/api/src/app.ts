import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
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
app.use(requestId);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/v1', authRoutes);
app.use('/api/v1', siteRoutes);
app.use('/api/v1', assetRoutes);
app.use('/api/v1', assignmentRoutes);

// Unknown route — clean JSON 404 instead of Express's default HTML page.
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use(errorHandler);

export default app;
