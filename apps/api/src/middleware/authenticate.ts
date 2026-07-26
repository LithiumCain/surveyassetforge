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

// Seeded organizations carry a placeholder clerkOrgId (never a real Clerk org).
// A placeholder org is "unclaimed" and may be linked to a real Clerk org later.
const SEED_ORG_PREFIX = 'org_seed_';

// Optional allowlist. When set, it gates every provisioning path that CLAIMS
// tenancy (JIT auto-provisioning, linking/creating an org from a Clerk org).
// Membership in an already-linked org is exempt — an org admin explicitly
// added that user. Unset = no restriction (dev).
const jitAllowedEmails = (process.env.CLERK_JIT_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const passesAllowlist = (email: string | null): boolean =>
  jitAllowedEmails.length === 0 || (!!email && jitAllowedEmails.includes(email.toLowerCase()));

type LocalUser = {
  id: string;
  organizationId: string;
  role: string;
  siteId: string | null;
  isActive: boolean;
  email: string | null;
};

const asString = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

const denied = (clerkUserId: string, email: string | null, reason: string): null => {
  console.warn(`[auth] provisioning denied for ${clerkUserId} (${email ?? 'no email'}): ${reason}`);
  return null;
};

// Pull name + email + invitation metadata from Clerk (best-effort; safe defaults
// on any failure). publicMetadata carries the saf_* fields we stamp onto an
// invitation so an invited user lands with the right role + site.
const fetchClerkProfile = async (clerkUserId: string): Promise<ClerkProfile> => {
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

type ClerkOrgMembership = {
  role: string; // e.g. "org:admin", "org:member", or a custom role
  organization: { id: string; name: string; slug: string | null };
};

const fetchClerkOrgMemberships = async (clerkUserId: string): Promise<ClerkOrgMembership[]> => {
  try {
    const res = await clerk.users.getOrganizationMembershipList({ userId: clerkUserId, limit: 10 });
    return res.data.map((m) => ({
      role: m.role,
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug ?? null,
      },
    }));
  } catch (err) {
    console.warn(`[auth] failed to read Clerk org memberships for ${clerkUserId}:`, err);
    return [];
  }
};

// Map a Clerk organization role onto a SAF role. Custom Clerk roles named after
// our roles (e.g. "org:site_supervisor") map directly; Clerk's built-in
// "org:admin" becomes super_admin; everything else gets org-wide read/manage.
const clerkOrgRoleToSafRole = (clerkRole: string): UserRole => {
  const bare = clerkRole.replace(/^org:/, '');
  if (VALID_ROLES.has(bare as UserRole)) return bare as UserRole;
  if (bare === 'admin') return 'super_admin';
  return 'regional_director';
};

type ClerkProfile = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  meta: Record<string, unknown>;
};

// Create the local user — or, when a row with the same email already exists in
// this org under a STALE clerkUserId (e.g. after a Clerk dev→production
// instance migration, where every user gets a new ID), relink that row to the
// new identity instead. Preserves role, site scope, and audit history.
const reclaimOrCreateUser = async (
  clerkUserId: string,
  organizationId: string,
  role: UserRole,
  siteId: string | null,
  profile: ClerkProfile,
): Promise<LocalUser> => {
  if (profile.email) {
    const stale = await prisma.user.findFirst({
      where: {
        organizationId,
        isActive: true,
        email: { equals: profile.email, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (stale) {
      console.info(`[auth] relinking user ${stale.id} (${profile.email}) to new Clerk id ${clerkUserId}`);
      return prisma.user.update({
        where: { id: stale.id },
        data: {
          clerkUserId,
          firstName: profile.firstName ?? stale.firstName,
          lastName: profile.lastName ?? stale.lastName,
        },
      });
    }
  }

  return prisma.user.create({
    data: {
      clerkUserId,
      organizationId,
      role,
      siteId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
    },
  });
};

// Resolve the local Organization behind a Clerk organization.
//   1. Already linked (clerkOrgId match) — always trusted.
//   2. Slug match / sole unclaimed seed org — relink it (allowlist-gated).
//      Handles Clerk dev→production migrations, where org IDs change.
//   3. Brand-new tenant — mirror the Clerk org locally (allowlist-gated).
const resolveOrgForMembership = async (
  clerkOrg: ClerkOrgMembership['organization'],
  email: string | null,
) => {
  const linked = await prisma.organization.findUnique({ where: { clerkOrgId: clerkOrg.id } });
  if (linked) return linked;

  // Everything below claims tenancy, so the allowlist (when set) applies.
  if (!passesAllowlist(email)) return null;

  if (clerkOrg.slug) {
    const bySlug = await prisma.organization.findUnique({ where: { slug: clerkOrg.slug } });
    if (bySlug) {
      console.info(`[auth] linking org "${bySlug.slug}" to Clerk org ${clerkOrg.id} (slug match)`);
      return prisma.organization.update({
        where: { id: bySlug.id },
        data: { clerkOrgId: clerkOrg.id },
      });
    }
  }

  // Exactly one unclaimed (seed-placeholder) org in the DB → adopt it, so a
  // fresh install / migrated instance attaches to its existing data.
  const placeholders = await prisma.organization.findMany({
    where: { clerkOrgId: { startsWith: SEED_ORG_PREFIX } },
    take: 2,
  });
  if (placeholders.length === 1) {
    console.info(`[auth] linking org "${placeholders[0].slug}" to Clerk org ${clerkOrg.id} (sole unclaimed org)`);
    return prisma.organization.update({
      where: { id: placeholders[0].id },
      data: { clerkOrgId: clerkOrg.id },
    });
  }

  // New tenant: mirror the Clerk organization locally.
  const slug = clerkOrg.slug ?? clerkOrg.id.toLowerCase();
  try {
    console.info(`[auth] creating org "${slug}" for Clerk org ${clerkOrg.id}`);
    return await prisma.organization.create({
      data: { clerkOrgId: clerkOrg.id, name: clerkOrg.name, slug },
    });
  } catch {
    // Lost a race (or slug collision) — re-check for the linked org.
    return prisma.organization.findUnique({ where: { clerkOrgId: clerkOrg.id } });
  }
};

// Resolve the SAF user behind a verified Clerk identity, syncing profile fields.
// Provisioning paths for unknown users, in order:
//   1. Invitation metadata (saf_*) stamped on the Clerk invitation.
//   2. Clerk ORGANIZATION membership — being added to your company's Clerk org
//      (dashboard or app) is the canonical way to grant access.
//   3. Dev JIT fallback via CLERK_JIT_ORG_SLUG.
// Anything else is denied.
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

  // --- 1. Invitation-based provisioning. A user invited through the app
  // carries saf_* metadata copied from the Clerk invitation. Honor it even
  // when the allowlist is set — they were explicitly invited.
  const invitedRole = asString(meta.saf_role) as UserRole | null;
  const invitedOrgSlug = asString(meta.saf_org_slug);
  if (invitedRole && invitedOrgSlug && VALID_ROLES.has(invitedRole)) {
    const org = await prisma.organization.findUnique({ where: { slug: invitedOrgSlug } });
    if (!org) return denied(clerkUserId, profile.email, `invited org "${invitedOrgSlug}" not found`);

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

    return reclaimOrCreateUser(clerkUserId, org.id, invitedRole, siteId, {
      ...profile,
      firstName: profile.firstName ?? asString(meta.saf_first_name),
      lastName: profile.lastName ?? asString(meta.saf_last_name),
    });
  }

  // --- 2. Clerk organization membership. Members of a Clerk org that maps to
  // (or can claim) a local organization are provisioned with a role derived
  // from their Clerk org role (org:admin → super_admin).
  const memberships = await fetchClerkOrgMemberships(clerkUserId);
  for (const membership of memberships) {
    const org = await resolveOrgForMembership(membership.organization, profile.email);
    if (!org) continue;
    const role = clerkOrgRoleToSafRole(membership.role);
    return reclaimOrCreateUser(clerkUserId, org.id, role, null, profile);
  }
  if (memberships.length > 0) {
    return denied(
      clerkUserId,
      profile.email,
      `member of ${memberships.length} Clerk org(s) but none could be linked (allowlist?)`,
    );
  }

  // --- 3. Dev JIT fallback: auto-provision into the demo org.
  const jitSlug = process.env.CLERK_JIT_ORG_SLUG;
  if (!jitSlug) return denied(clerkUserId, profile.email, 'no Clerk org membership and JIT is off');

  const org = await prisma.organization.findUnique({ where: { slug: jitSlug } });
  if (!org) return denied(clerkUserId, profile.email, `JIT org "${jitSlug}" not found`);

  if (!passesAllowlist(profile.email)) {
    return denied(clerkUserId, profile.email, 'email not on CLERK_JIT_ALLOWED_EMAILS');
  }

  // Validate the configured JIT role — a typo'd env value must not produce a
  // broken row (or a silently wrong privilege level).
  const configured = process.env.CLERK_JIT_ROLE;
  let role: UserRole = 'super_admin'; // documented dev default
  if (configured) {
    if (VALID_ROLES.has(configured as UserRole)) {
      role = configured as UserRole;
    } else {
      console.warn(`[auth] invalid CLERK_JIT_ROLE "${configured}" — using super_admin`);
    }
  }
  return reclaimOrCreateUser(clerkUserId, org.id, role, null, profile);
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
