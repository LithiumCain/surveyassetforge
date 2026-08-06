# Survey Asset Forge — Architecture Foundation

This document describes the multi-tenant foundation introduced on the
`feat/multi-tenant-clerk-foundation` branch. It is the "build it right" base the
product is licensed on.

## Apps

| App | Path | Stack | Deploys to |
|-----|------|-------|-----------|
| API | `apps/api` | Express + TypeScript + Prisma 7 (`pg` adapter) | Vercel `surveyassetforge-api` (root `apps/api`) |
| Web | `apps/web` | React + TypeScript + Vite | Vercel `surveyassetforge-web` (root `apps/web`) |

Database: **Neon Postgres**. The web app talks to the API at `VITE_API_BASE_URL`
(`…/api/v1`).

## Multi-tenancy (the core idea)

One **Organization** = one licensed company. Every business table carries an
`organizationId`, and **every API query is scoped by the signed-in user's
organization** (`req.user.organizationId`). Site supervisors are further scoped
to their own `siteId`. Cross-tenant data access is therefore structurally
impossible, not just hidden in the UI.

Models: `Organization → Site → Equipment / User / AssetAssignment`, plus
`AuditLog`. See `apps/api/prisma/schema.prisma` (the single source of truth — the
SQL tables are generated from it via Prisma Migrate).

## Auth (Clerk) — current state

- **Identity is owned by Clerk.** Users sign in via Clerk; our `User` table keeps
  a local row keyed by `clerkUserId`, and `Organization` maps to a Clerk
  Organization via `clerkOrgId`. No passwords are stored.
- **Session verification is live**: `apps/api/src/middleware/authenticate.ts`
  verifies the Clerk session token on every request and resolves (or
  provisions) the local user. Provisioning paths, in order: app invitation
  (`saf_*` metadata), **Clerk organization membership** (the canonical way —
  `org:admin` → `super_admin`), then the JIT env fallback. Full details and
  troubleshooting in `docs/CLERK_PROVISIONING.md`.
- A dev-only test shim remains behind `DEV_AUTH=1` + an `x-dev-user` header
  (a seeded `clerkUserId`) for local/automated testing. It is hard-disabled when
  `NODE_ENV=production` — it accepts a plaintext header in place of a token, and
  the seeded IDs it takes are published in this repo.

## Audit logging

Every create / update / archive / assignment writes one row to `audit_logs`
through `apps/api/src/services/audit.ts` (`recordAudit` / `auditFromRequest`):
actor, action, entity, old→new value, IP, and user-agent — all org-scoped.

## Soft delete

Equipment is never hard-deleted. `DELETE /assets/:id` is a **disposition**: the
caller supplies a terminal status (`sold`, `lost`, `stolen`, `written_off`) plus
optional notes, and the route records it. Asset lists filter to `status: 'active'`,
so a disposed item drops out of the fleet while its custody, calibration, and
audit history are preserved for compliance.

## Database workflow (against a Neon branch)

From `apps/api`, with `DATABASE_URL` pointing at a Neon branch in `.env`
(git-ignored):

```bash
npx prisma migrate dev      # create/apply migrations from schema.prisma
npx prisma db seed          # load the fictional "Faeheart Survey Co" demo data
```

The seed (`prisma/seed.ts`) is idempotent and 100% fictional — 1 org, 4 sites
(3 active + 1 inactive), 5 users, ~15 equipment items across every calibration state.

## Running the API locally (dev shim)

```bash
cd apps/api
DEV_AUTH=1 npx tsx src/server.ts          # http://localhost:4000
# then send requests with a seeded user, e.g.:
#   header  x-dev-user: user_seed_admin       (sees all sites)
#   header  x-dev-user: user_seed_sup_nvy     (only North Valley Yard)
```

## Still pending (next steps)

1. Automated tests — there are none. CI typechecks, builds, and asserts the web
   bundle contains application code, but nothing exercises behavior.
2. Rate limiting. No limiter is registered; `POST /uploads/calibration-photo`
   accepts an 8 MB body from any provisioned user and writes it to public blob
   storage with no per-user quota.
3. `xlsx@0.18.5` carries unfixed prototype-pollution and ReDoS advisories, and the
   npm package is unmaintained (SheetJS distributes from its own CDN now). It runs
   client-side on a file the user chose, so the blast radius is their own browser —
   but it should be replaced or pinned to the vendor build before a wider rollout.
4. Pagination — asset lists return the full set for the caller's scope.
5. Firmware source sync.
