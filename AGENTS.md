# Repository Guidelines

## Project Structure & Module Organization
This repository is a full-stack monorepo (npm workspaces) for the FieldOps Asset Dashboard.
- `apps/api`: Node.js + Express + TypeScript API. Clerk authentication + role/site-based access control, business logic, route handlers in `src/`. Prisma 7 client over a `pg` Pool (`src/lib/prisma.ts`); config in `src/config/env.ts`.
- `apps/web`: React + TypeScript + Vite frontend. Source in `src/`, talks to the API via `VITE_API_BASE_URL`.
- `apps/api/prisma`: the authoritative schema, migrations, and seed (`schema.prisma`, `prisma.config.ts`, `seed.ts`).
- Workbook import is done in the browser (`apps/web/src/lib/workbook.ts` -> `POST /import/workbook`), not by a script.

## Build, Test, and Development Commands
- `npm install`: install all workspaces.
- `npm run db:up` then `npm run db:migrate` then `npm run db:seed`: start local Postgres (Docker), apply Prisma migrations, seed demo data.
- `npm run dev`: run API and web together. `npm run dev:stack` also brings up the DB first.
- `npm run dev -w @hartsystem/api` / `-w @hartsystem/web`: run one workspace.
- `npm run build`: build both workspaces (`tsc` for api, `tsc --noEmit && vite build` for web). The web build FAILS without `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_BASE_URL` — by design; without them the bundle silently compiles to a blank page.
- `npm run lint`: type-check both workspaces (`tsc --noEmit`).

## Deployment
Two Vercel projects, both Git-connected to `main` (auto-deploy on push):
- `surveyassetforge-api` — Root Directory `apps/api`. Env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `BLOB_READ_WRITE_TOKEN`, `WEB_ORIGIN`, `CLERK_JIT_ALLOWED_EMAILS`.
- `surveyassetforge-web` — Root Directory `apps/web` (Vite). Env: `VITE_API_BASE_URL` (the API's `/api/v1` URL) and `VITE_CLERK_PUBLISHABLE_KEY`.

Database is Neon Postgres. Migrations are **not** run on deploy — apply them with
`npm exec -w @hartsystem/api -- prisma migrate deploy` against the Neon `DATABASE_URL`.
Never hand-apply SQL that Prisma did not generate; the schema in `apps/api/prisma/migrations`
is the only source of truth.

## Coding Style & Naming Conventions
- 2-space indentation; TypeScript throughout. ES modules (`"type": "module"`).
- API routes mount under `/api/v1`. Keep route/handler/middleware concerns separated.
- Validate inputs (zod) and keep secrets in env vars, never committed.

## Testing Guidelines
Automated tests are not yet configured. Verify changes by running the stack locally and exercising affected endpoints/screens. For date/calibration/depreciation math, test boundary cases.

## Commit & Pull Request Guidelines
- Commit format: `type(scope): summary` (e.g. `fix(calibration): correct warning threshold`).
- Keep commits focused (api vs web vs db).
- PRs should include: purpose, affected files, manual test steps, and screenshots/GIFs for UI changes. Link related issue/ticket IDs.

## Security & Configuration Tips
- Do not commit real employee/asset identifiers or secrets; keep `.env` local (gitignored) and set production values in the Vercel dashboard.
- In production, set `CLERK_JIT_ALLOWED_EMAILS`. Tenancy-claiming provisioning fails
  closed when it is empty, which is the safe default — but it means org auto-linking
  and JIT provisioning simply will not work until you list the addresses that may use them.
- Set `WEB_ORIGIN` in production so CORS and Clerk token audiences are pinned to your own frontend.
