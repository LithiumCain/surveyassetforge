import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { authenticate } from '../middleware/authenticate.js';
import { comparePassword, signToken } from '../services/auth.js';
import { UserRole } from '../types/auth.js';

const loginSchema = z.object({
  username: z.string(),
  password: z.string().min(8),
});

export const authRoutes = Router();

export const authRoutes = Router();

authRoutes.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const { username, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken({
      sub: user.id,
      role: user.role,
      siteId: user.siteId,
      username: user.username,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        siteId: user.siteId,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRoutes.get('/users/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        siteId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    next(err);
  }
});
