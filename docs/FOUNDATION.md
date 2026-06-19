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
- **Pending:** the API's `authenticate` middleware is currently a **dev-only
  shim** (`apps/api/src/middleware/authenticate.ts`). It is disabled unless
  `DEV_AUTH=1` and resolves the request user from an `x-dev-user` header (a
  seeded `clerkUserId`). In production it returns 401 until Clerk session
  verification is dropped in. Search the code for `TODO(clerk)`.

## Audit logging

Every create / update / archive / assignment writes one row to `audit_logs`
through `apps/api/src/services/audit.ts` (`recordAudit` / `auditFromRequest`):
actor, action, entity, old→new value, IP, and user-agent — all org-scoped.

## Soft delete

Equipment is never hard-deleted. `DELETE /assets/:id` sets `status = archived`;
lists exclude archived items. History is preserved for compliance.

## Database workflow (against a Neon branch)

From `apps/api`, with `DATABASE_URL` pointing at a Neon branch in `.env`
(git-ignored):

```bash
npx prisma migrate dev      # create/apply migrations from schema.prisma
npx prisma db seed          # load the fictional "Faeheart Survey Co" demo data
```

The seed (`prisma/seed.ts`) is idempotent and 100% fictional — 1 org, 3 sites,
5 users (one per role), ~15 equipment items across every calibration state.

## Running the API locally (dev shim)

```bash
cd apps/api
DEV_AUTH=1 npx tsx src/server.ts          # http://localhost:4000
# then send requests with a seeded user, e.g.:
#   header  x-dev-user: user_seed_admin       (sees all sites)
#   header  x-dev-user: user_seed_sup_nvy     (only North Valley Yard)
```

## Still pending (next steps)

1. Wire real Clerk session verification into `authenticate` (replace the shim).
2. Add Clerk sign-in + organization context to `apps/web`.
3. Provision a production Neon database and run migrations there.
4. UX polish pass (loading/empty states, toasts, branded 404/500).
5. Update the root `README.md` (still describes the old JWT design).
