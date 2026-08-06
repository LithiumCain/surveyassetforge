# Survey Asset Forge

Equipment, calibration, and fleet tracking for survey field operations.

Survey crews track expensive gear — GNSS receivers, total stations, data collectors —
across job sites in spreadsheets that go stale the moment someone drives off with a
tripod. Survey Asset Forge replaces the spreadsheet: every asset has a site, a custody
history, a calibration schedule, and a barcode you can scan from a phone in the field.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (Neon in production) via Prisma
- **Auth:** Clerk — organization-based, with role-based access control

## Quick Start

```bash
cp .env.example .env          # then fill in the Clerk keys — see below
npm install
npm run db:up                 # local Postgres via Docker (skip if using Neon)
npm run db:migrate            # prisma migrate deploy
npm run db:seed               # demo org, sites, and users
npm run dev                   # API on :4000, web on :5173
```

`npm run dev:stack` does the Postgres + migrate + seed + dev sequence in one command.

### Clerk keys are required

The app will not start without them:

- `CLERK_SECRET_KEY` (API) and `VITE_CLERK_PUBLISHABLE_KEY` (web) come from your
  Clerk dashboard.
- `VITE_API_BASE_URL` tells the web app where the API lives.

Both `VITE_*` values are baked in at build time, and the build **fails** if either is
missing. That is deliberate: without them the bundle silently compiles down to a blank
page, so a loud build failure is much better than a quiet broken deploy.

There is no local password login — sign-in goes through Clerk. See
[docs/CLERK_PROVISIONING.md](docs/CLERK_PROVISIONING.md) for how a Clerk identity
becomes a Survey Asset Forge user, and how to grant someone access.

## Roles

| Role | Scope |
| --- | --- |
| `super_admin` | Everything, every site, including asset edits and dispositions |
| `regional_director` | Fleet-wide visibility, check-in/out, calibrations, site creation |
| `site_supervisor` | Locked to a single site — scan, calibrate, check gear in and out |

Roles are enforced server-side on every route; the UI only decides what to show.

## Repo Layout

- `apps/api` — Express routes, Clerk authentication, role/site authorization, business logic
- `apps/api/prisma` — the authoritative schema, migrations, and seed data
- `apps/web` — the dashboard, reports, team management, and mobile scanner UI
- `docs-api.md` — endpoint reference
- `docs/FOUNDATION.md` — architecture and multi-tenancy model
- `docs/CLERK_PROVISIONING.md` — how users get provisioned

## Workbook Import

The product imports an existing `Survey Asset Tracker.xlsx` directly in the browser:
sign in as a super admin and use **Import your workbook** on the dashboard. Every site
tab becomes a site and every row becomes a tracked asset, parsed client-side and sent
to the API in chunks. Re-importing is safe — existing asset numbers are skipped rather
than duplicated.

## Database Helpers

- `npm run db:up` / `npm run db:down` — local Postgres via Docker Compose
- `npm run db:migrate` — applies Prisma migrations (`prisma migrate deploy`)
- `npm run db:seed` — seeds the demo organization, sites, and users

To create a new migration after editing `apps/api/prisma/schema.prisma`:

```bash
npm exec -w @hartsystem/api -- prisma migrate dev --name your_change
```

## Testing

Automated tests are not yet configured. CI runs a typecheck and a production build of
both apps, and asserts that the web bundle actually contains application code.
