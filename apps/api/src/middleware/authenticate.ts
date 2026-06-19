import { NextFunction, Request, Response } from 'express';
import { verifyToken, createClerkClient } from '@clerk/backend';
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

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

type LocalUser = {
  id: string;
  organizationId: string;
  role: string;
  siteId: string | null;
  isActive: boolean;
  email: string | null;
};

// Pull name + email from Clerk for a user (best-effort; null on any failure).
const fetchClerkProfile = async (clerkUserId: string) => {
  try {
    const cu = await clerk.users.getUser(clerkUserId);
    return {
      email: cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress ?? null,
      firstName: cu.firstName ?? cu.username ?? null,
      lastName: cu.lastName ?? null,
    };
  } catch {
    return { email: null, firstName: null, lastName: null };
  }
};

// Resolve the SAF user behind a verified Clerk identity, syncing profile fields.
// Unknown users are denied unless dev JIT provisioning is enabled.
const resolveLocalUser = async (clerkUserId: string): Promise<LocalUser | null> => {
  const existing = await prisma.user.findUnique({ where: { clerkUserId } });

  if (existing) {
    // Backfill name/email once (when email is still empty); cheap thereafter.
    if (!existing.email) {
      const profile = await fetchClerkProfile(clerkUserId);
      if (profile.email || profile.firstName) {
        return prisma.user.update({ where: { id: existing.id }, data: profile });
      }
    }
    return existing;
  }

  const jitSlug = process.env.CLERK_JIT_ORG_SLUG;
  if (!jitSlug) return null; // deny-by-default

  const org = await prisma.organization.findUnique({ where: { slug: jitSlug } });
  if (!org) return null;

  const role = (process.env.CLERK_JIT_ROLE as UserRole) ?? 'super_admin';
  const profile = await fetchClerkProfile(clerkUserId);
  return prisma.user.create({
    data: { clerkUserId, organizationId: org.id, role, ...profile },
  });
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // --- Dev-only test shim (automated testing): DEV_AUTH=1 + x-dev-user header.
    if (process.env.DEV_AUTH === '1' && req.header('x-dev-user')) {
      const user = await prisma.user.findUnique({
        where: { clerkUserId: req.header('x-dev-user')! },
      });
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
      return;
    }

    // --- Real auth: verify the Clerk session token.
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ message: 'Missing Authorization header' });
      return;
    }

    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ message: 'Auth is not configured' });
      return;
    }

    let claims: { sub: string };
    try {
      claims = (await verifyToken(token, { secretKey })) as typeof claims;
    } catch {
      res.status(401).json({ message: 'Invalid or expired session' });
      return;
    }

    const user = await resolveLocalUser(claims.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Your account is not provisioned for Survey Asset Forge' });
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
