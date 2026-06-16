import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthUser, UserRole } from '../types/auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// TODO(clerk): Replace this development shim with real Clerk session
// verification. The shim resolves the request user from the `x-dev-user`
// header (a seeded clerkUserId, defaulting to the demo admin). It is
// HARD-DISABLED unless DEV_AUTH=1, so it can never authenticate anyone in a
// production deployment — there it returns 401 until Clerk is wired.
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (process.env.DEV_AUTH !== '1') {
    res.status(401).json({ message: 'Authentication not configured (Clerk integration pending)' });
    return;
  }

  try {
    const clerkUserId = (req.header('x-dev-user') ?? 'user_seed_admin').toString();
    const user = await prisma.user.findUnique({ where: { clerkUserId } });

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Dev user not found or inactive' });
      return;
    }

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      role: user.role as UserRole,
      siteId: user.siteId,
    };
    next();
  } catch (err) {
    next(err);
  }
};
