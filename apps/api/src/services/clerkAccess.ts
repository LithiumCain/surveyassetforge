// Ongoing access checks against Clerk for users who are ALREADY provisioned.
//
// Provisioning consults Clerk exactly once, on a user's first sign-in. After
// that the local users row was the only thing checked, so removing someone from
// the company's organization in Clerk did nothing here: their Clerk session
// stayed valid and the API kept answering them. This re-validates, per request,
// that the reason they were let in still holds — with a short per-instance
// cache so a page load costs at most one round of Clerk calls.
//
// Denial never writes to the database. Re-adding someone in Clerk restores
// their access, role and site intact; deactivating on the Team page is still the
// way to shut someone out regardless of Clerk.
//
// Where Clerk cannot answer (outage, rate limit) access is ALLOWED. A Clerk
// incident locking every customer out of their fleet is the worse failure, and
// removal still takes effect on the next check once Clerk recovers.

export type AccessUser = {
  id: string;
  clerkUserId: string;
  organizationId: string;
  role: string;
};

export type AccessOrg = { id: string; slug: string; clerkOrgId: string };

export type ClerkUserSnapshot =
  | { kind: 'missing' } // deleted in Clerk (404)
  | { kind: 'unavailable'; detail: string }
  | {
      kind: 'found';
      banned: boolean;
      email: string | null;
      meta: Record<string, unknown>;
      memberOrgIds: string[];
      // False when the user is in more Clerk orgs than one page returned, so a
      // missing org id does not prove they were removed from it.
      membershipsComplete: boolean;
    };

export type AccessDeps = {
  loadOrg: (organizationId: string) => Promise<AccessOrg | null>;
  getClerkUser: (clerkUserId: string) => Promise<ClerkUserSnapshot>;
  clerkOrgExists: (clerkOrgId: string) => Promise<'yes' | 'no' | 'unknown'>;
  countActiveSuperAdmins: (organizationId: string) => Promise<number>;
  canClaimTenancy: (email: string | null) => boolean;
  jitOrgSlug: string | null;
  seedOrgPrefix: string;
  validRoles: ReadonlySet<string>;
};

export type AllowReason =
  | 'seed_org'
  | 'member'
  | 'invited'
  | 'jit_org'
  | 'clerk_unavailable'
  | 'memberships_truncated'
  | 'org_link_stale'
  | 'last_super_admin'
  | 'org_missing';

export type DenyReason = 'account_removed' | 'membership_removed';

export type AccessDecision =
  | { allow: true; reason: AllowReason }
  | { allow: false; reason: DenyReason };

const allow = (reason: AllowReason): AccessDecision => ({ allow: true, reason });
const deny = (reason: DenyReason): AccessDecision => ({ allow: false, reason });

// Each rule mirrors a provisioning path in authenticate.ts: a user keeps access
// while the path that admitted them would still admit them today.
export const decideAccess = async (user: AccessUser, deps: AccessDeps): Promise<AccessDecision> => {
  const org = await deps.loadOrg(user.organizationId);
  // The FK makes this unreachable; if it happens it is a data problem, not a
  // revocation, and the routes will fail on their own.
  if (!org) return allow('org_missing');

  // A placeholder org has no Clerk organization to be removed from.
  if (org.clerkOrgId.startsWith(deps.seedOrgPrefix)) return allow('seed_org');

  const cu = await deps.getClerkUser(user.clerkUserId);
  if (cu.kind === 'unavailable') return allow('clerk_unavailable');
  // Deleting or banning a user in Clerk also ends their sessions, so this is
  // mostly belt-and-braces for a token minted moments before.
  if (cu.kind === 'missing' || cu.banned) return deny('account_removed');

  // Path 2: member of the Clerk org this organization is linked to.
  if (cu.memberOrgIds.includes(org.clerkOrgId)) return allow('member');

  // Path 1: invited through the app. Those invitations are not Clerk org
  // invitations, so these users are never org members to begin with — the Team
  // page's Deactivate is how they are removed.
  const invitedRole = typeof cu.meta.saf_role === 'string' ? cu.meta.saf_role : null;
  if (invitedRole && deps.validRoles.has(invitedRole) && cu.meta.saf_org_slug === org.slug) {
    return allow('invited');
  }

  // Path 3: JIT, and they would still be admitted by it today.
  if (deps.jitOrgSlug && org.slug === deps.jitOrgSlug && deps.canClaimTenancy(cu.email)) {
    return allow('jit_org');
  }

  if (!cu.membershipsComplete) return allow('memberships_truncated');

  // Everything below is about to deny. Before doing so, rule out the two ways
  // this check could lock out an organization that did nothing wrong.

  // The org is linked to a Clerk organization that no longer exists (e.g. the
  // Clerk instance was switched). Nobody can be a member of it, so denying
  // would revoke the whole company at once. That is a misconfiguration to fix
  // with tenant-doctor --link, not a removal.
  const exists = await deps.clerkOrgExists(org.clerkOrgId);
  if (exists === 'unknown') return allow('clerk_unavailable');
  if (exists === 'no') return allow('org_link_stale');

  // Never lock out the last super admin: nobody would be left to fix roles,
  // sites or the Clerk link from inside the app.
  if (user.role === 'super_admin' && (await deps.countActiveSuperAdmins(org.id)) <= 1) {
    return allow('last_super_admin');
  }

  return deny('membership_removed');
};

export type AccessMode = 'enforce' | 'report' | 'off';

export const parseAccessMode = (raw: string | undefined): AccessMode => {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'off' || v === 'report') return v;
  if (v && v !== 'enforce') {
    console.warn(`[auth] unknown CLERK_MEMBERSHIP_CHECK "${raw}" — enforcing`);
  }
  return 'enforce';
};

// How long one answer is reused on this instance. Removal takes effect within
// ALLOW_TTL; a re-added user waits at most DENY_TTL.
export const ALLOW_TTL_MS = 5 * 60_000;
export const DENY_TTL_MS = 30_000;
// Allowed only because Clerk could not answer: ask again soon.
export const UNAVAILABLE_TTL_MS = 30_000;

const WARN_REASONS = new Set<AllowReason>([
  'clerk_unavailable',
  'memberships_truncated',
  'org_link_stale',
  'last_super_admin',
]);

const ttlFor = (d: AccessDecision): number =>
  !d.allow ? DENY_TTL_MS : d.reason === 'clerk_unavailable' ? UNAVAILABLE_TTL_MS : ALLOW_TTL_MS;

export type AccessChecker = {
  check: (user: AccessUser) => Promise<AccessDecision>;
  // Seed the cache for a user who was provisioned on this very request — their
  // access was established from Clerk moments ago.
  prime: (user: AccessUser, reason?: AllowReason) => void;
  clear: () => void;
};

export const createAccessChecker = (
  deps: AccessDeps,
  { mode = 'enforce' as AccessMode, now = () => Date.now(), maxEntries = 5_000 } = {},
): AccessChecker => {
  const cache = new Map<string, { decision: AccessDecision; expires: number }>();
  // The dashboard fires several requests at once; let them share one lookup.
  const inFlight = new Map<string, Promise<AccessDecision>>();

  const keyOf = (u: AccessUser) => `${u.clerkUserId}:${u.organizationId}`;

  const store = (key: string, decision: AccessDecision) => {
    if (cache.size >= maxEntries) {
      const t = now();
      for (const [k, v] of cache) if (v.expires <= t) cache.delete(k);
      if (cache.size >= maxEntries) cache.clear();
    }
    cache.set(key, { decision, expires: now() + ttlFor(decision) });
  };

  const run = async (user: AccessUser): Promise<AccessDecision> => {
    let decision: AccessDecision;
    try {
      decision = await decideAccess(user, deps);
    } catch (err) {
      // A bug or DB error in the check itself must not take auth down with it.
      console.warn(`[auth] access check failed for ${user.clerkUserId}; allowing:`, err);
      decision = allow('clerk_unavailable');
    }

    if (!decision.allow) {
      console.warn(
        `[auth] ${mode === 'enforce' ? 'access revoked' : 'WOULD revoke (report mode)'} for user ${user.id} ` +
          `(clerk ${user.clerkUserId}, org ${user.organizationId}): ${decision.reason}`,
      );
    } else if (WARN_REASONS.has(decision.reason)) {
      console.warn(`[auth] access allowed for user ${user.id} (clerk ${user.clerkUserId}) only because: ${decision.reason}`);
    }

    if (mode === 'report' && !decision.allow) {
      // Cache the would-be denial as such so the log line is not repeated on
      // every request, but hand the caller an allow.
      store(keyOf(user), decision);
      return allow('member');
    }
    store(keyOf(user), decision);
    return decision;
  };

  return {
    check: async (user) => {
      if (mode === 'off') return allow('member');
      const key = keyOf(user);
      const hit = cache.get(key);
      if (hit && hit.expires > now()) {
        return mode === 'report' && !hit.decision.allow ? allow('member') : hit.decision;
      }
      const pending = inFlight.get(key);
      if (pending) return pending;
      const p = run(user).finally(() => inFlight.delete(key));
      inFlight.set(key, p);
      return p;
    },
    prime: (user, reason = 'member') => {
      store(keyOf(user), allow(reason));
    },
    clear: () => {
      cache.clear();
      inFlight.clear();
    },
  };
};
