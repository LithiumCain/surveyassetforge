# Repository Guidelines

## Project Structure & Module Organization
This repository is a full-stack monorepo (npm workspaces) for the FieldOps Asset Dashboard.
- `apps/api`: Node.js + Express + TypeScript API. JWT auth + role-based access, business logic, route handlers in `src/`. Prisma 7 client over a `pg` Pool (`src/app.ts`); config in `src/config/env.ts`.
- `apps/web`: React + TypeScript + Vite frontend. Source in `src/`, talks to the API via `VITE_API_BASE_URL`.
- `db/migrations`: raw SQL schema + seed (`001_initial_schema.sql`, `002_seed_data.sql`), applied with `psql`.
- `scripts/`: `db_migrate.sh` / `db_reset.sh` (apply SQL + import workbook), and the Excel import helpers.
- `data/`: generated sample JSON. `Survey Asset Tracker.xlsx` is the source of truth for local business data.
- `prisma` lives under `apps/api/prisma` (`schema.prisma`, `prisma.config.ts`, `seed.ts`).

## Build, Test, and Development Commands
- `npm install`: install all workspaces.
- `npm run db:up` then `npm run db:migrate`: start local Postgres (Docker) and apply SQL migrations + workbook import.
- `npm run dev`: run API and web together. `npm run dev:stack` also brings up the DB first.
- `npm run dev -w @hartsystem/api` / `-w @hartsystem/web`: run one workspace.
- `npm run build`: build both workspaces (`tsc` for api, `tsc -b && vite build` for web).
- `npm run lint`: type-check both workspaces (`tsc --noEmit`).
- `npm run bootstrap:windows`: one-shot Windows local setup via `winget` + Docker.

## Deployment
Two Vercel projects, both Git-connected to `main` (auto-deploy on push):
- `surveyassetforge-api` — Root Directory `apps/api`. Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`.
- `surveyassetforge-web` — Root Directory `apps/web` (Vite). Env: `VITE_API_BASE_URL` (→ the API's `/api/v1` URL).
Database is Neon Postgres. Migrations are **not** run on deploy — apply `db/migrations/*.sql` to Neon manually (Neon SQL editor or `psql`).

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
- Use a strong random `JWT_SECRET` in production (not the `.env.example` placeholder).
