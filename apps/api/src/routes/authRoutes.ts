import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';

export const authRoutes = Router();

// Login is handled by Clerk on the client; the API no longer issues tokens.
// TODO(clerk): add a Clerk webhook to sync Clerk users/orgs -> our User table.

// Who am I — returns the signed-in user with their org + site context.
authRoutes.get('/users/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        siteId: true,
        organizationId: true,
        site: { select: { id: true, code: true, name: true } },
        organization: { select: { id: true, name: true, slug: true } },
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
