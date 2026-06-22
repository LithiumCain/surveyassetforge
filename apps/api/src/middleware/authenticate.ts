import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '@clerk/backend';
import { prisma } from '../lib/prisma.js';
import { clerk } from '../lib/clerk.js';
import { AuthUser, UserRole } from '../types/auth.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const VALID_ROLES = new Set<UserRole>(['super_admin', 'regional_director', 'site_supervisor']);

// Optional JIT allowlist. When set, only these emails may be auto-provisioned;
// every other sign-up is denied even with JIT on. Unset = no restriction (dev).
const jitAllowedEmails = (process.env.CLERK_JIT_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

type LocalUser = {
  id: string;
  organizationId: string;
  role: string;
  siteId: string | null;
  isActive: boolean;
  email: string | null;
};

const asString = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

// Pull name + email + invitation metadata from Clerk (best-effort; safe defaults
// on any failure). publicMetadata carries the saf_* fields we stamp onto an
// invitation so an invited user lands with the right role + site.
const fetchClerkProfile = async (clerkUserId: string) => {
  try {
    const cu = await clerk.users.getUser(clerkUserId);
    return {
      email: cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses[0]?.emailAddress ?? null,
      firstName: cu.firstName ?? cu.username ?? null,
      lastName: cu.lastName ?? null,
      meta: (cu.publicMetadata ?? {}) as Record<string, unknown>,
    };
  } catch {
    return { email: null, firstName: null, lastName: null, meta: {} as Record<string, unknown> };
  }
};

// Resolve the SAF user behind a verified Clerk identity, syncing profile fields.
// Unknown users are denied unless they were invited (saf_* metadata) or dev JIT
// provisioning is enabled.
const resolveLocalUser = async (clerkUserId: string): Promise<LocalUser | null> => {
  const existing = await prisma.user.findUnique({ where: { clerkUserId } });

  if (existing) {
    // Backfill name/email once (when email is still empty); cheap thereafter.
    if (!existing.email) {
      const profile = await fetchClerkProfile(clerkUserId);
      if (profile.email || profile.firstName) {
        return prisma.user.update({
          where: { id: existing.id },
          data: { email: profile.email, firstName: profile.firstName, lastName: profile.lastName },
        });
      }
    }
    return existing;
  }

  const profile = await fetchClerkProfile(clerkUserId);
  const meta = profile.meta;

  // --- Invitation-based provisioning (preferred). A user invited through the
  // app carries saf_* metadata copied from the Clerk invitation. Honor it even
  // when the JIT allowlist is set — they were explicitly invited.
  const invitedRole = asString(meta.saf_role) as UserRole | null;
  const invitedOrgSlug = asString(meta.saf_org_slug);
  if (invitedRole && invitedOrgSlug && VALID_ROLES.has(invitedRole)) {
    const org = await prisma.organization.findUnique({ where: { slug: invitedOrgSlug } });
    if (!org) return null;

    // Only accept a site that actually belongs to the invited org (guards
    // against tampered metadata pointing at another tenant's site).
    let siteId: string | null = null;
    const metaSiteId = asString(meta.saf_site_id);
    if (metaSiteId) {
      const site = await prisma.site.findFirst({
        where: { id: metaSiteId, organizationId: org.id },
      });
      siteId = site?.id ?? null;
    }

    return prisma.user.create({
      data: {
        clerkUserId,
        organizationId: org.id,
        role: invitedRole,
        siteId,
        email: profile.email,
        firstName: profile.firstName ?? asString(meta.saf_first_name),
        lastName: profile.lastName ?? asString(meta.saf_last_name),
      },
    });
  }

  // --- Dev JIT fallback: auto-provision into the demo org as super_admin.
  const jitSlug = process.env.CLERK_JIT_ORG_SLUG;
  if (!jitSlug) return null; // deny-by-default

  const org = await prisma.organization.findUnique({ where: { slug: jitSlug } });
  if (!org) return null;

  // Lockdown: when an allowlist is configured, deny any sign-up whose email is
  // not on it — no account is created. Existing users never reach this code.
  if (jitAllowedEmails.length > 0) {
    const email = profile.email?.toLowerCase() ?? null;
    if (!email || !jitAllowedEmails.includes(email)) return null;
  }

  const role = (process.env.CLERK_JIT_ROLE as UserRole) ?? 'super_admin';
  return prisma.user.create({
    data: {
      clerkUserId,
      organizationId: org.id,
      role,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
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
