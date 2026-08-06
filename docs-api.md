# API Reference

Base URL: `/api/v1` (health check is at `/health`, outside the versioned prefix).

## Authentication

Every endpoint except `GET /health` requires a Clerk session token:

```
Authorization: Bearer <clerk session token>
```

The web app attaches this automatically. There is no login endpoint — Clerk issues the
token on the client, and the API verifies it. A verified Clerk identity is then mapped
to a Survey Asset Forge user; see [docs/CLERK_PROVISIONING.md](docs/CLERK_PROVISIONING.md)
for how that mapping is established and how someone gets access.

Unprovisioned or deactivated users receive `401`.

## Roles and scoping

Three roles: `super_admin`, `regional_director`, `site_supervisor`.

Two rules apply on the server to every request, regardless of what the UI shows:

- **Organization scoping.** Every query is filtered to the caller's organization. There
  is no way to read or write another tenant's data.
- **Site scoping.** A `site_supervisor` is restricted to their assigned site. A
  supervisor with no site assigned sees unassigned inventory only.

The "Roles" column below lists who may call each endpoint. Where it says *all*, the
caller still only sees what their site scope allows.

## Endpoints

### Health

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/health` | public | Static `{ status: 'ok' }` |

### Session

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/users/me` | all | The caller's profile, role, and site |

### Sites

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/sites` | all | Supervisors receive only their own site |
| POST | `/sites` | super_admin, regional_director | Create a site |
| POST | `/sites/:siteId/invite` | super_admin, regional_director | Invite a site supervisor by email; the invitation carries the role and site |
| GET | `/dashboard/regional` | super_admin, regional_director | Per-site rollup used by Fleet Alerts |

### Assets

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/assets` | all | Active assets in scope |
| GET | `/assets/:id` | all | Single asset |
| POST | `/assets` | super_admin, site_supervisor | Create |
| PUT | `/assets/:id` | super_admin, site_supervisor | Update |
| DELETE | `/assets/:id` | super_admin | **Not a delete** — records a disposition (`sold`, `lost`, `stolen`, `written_off`) supplied in the body. Nothing is ever hard-deleted; the row leaves the active list but keeps its history |
| POST | `/scan/asset` | all | Look up an asset by its barcode / asset number |

### Calibration

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/assets/:id/calibrations` | all | Calibration history |
| POST | `/assets/:id/calibrations` | all | Log a calibration; recomputes the asset's status and next-due date |
| POST | `/uploads/calibration-photo` | all | Upload a calibration photo, returns its URL. Requires `BLOB_READ_WRITE_TOKEN` |

### Custody / assignments

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| POST | `/assets/:assetId/assign` | all | Check an asset out to a person |
| POST | `/assets/:assetId/checkin` | all | Check it back in |
| GET | `/assets/:assetId/assignments` | all | Full custody history for one asset |
| GET | `/assignments/active` | all | Everything currently checked out; supervisors see only their site |

### Team

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/users` | super_admin, regional_director | Team roster |
| PATCH | `/users/:id` | super_admin | Change role, site, or active status. A super admin cannot demote or deactivate themselves |

### Import

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| POST | `/import/workbook` | super_admin | Bulk-create sites and assets from a parsed workbook. Idempotent — existing asset numbers are skipped. Bounded to 150 sites / 5000 assets per request; the web client chunks larger workbooks |

## Errors

Errors are JSON: `{ "message": "..." }`, sometimes with an `issues` array for
validation failures.

| Status | Meaning |
| --- | --- |
| 400 | Request body failed validation |
| 401 | Missing/invalid token, or the account is not provisioned |
| 403 | Authenticated, but the role or site scope forbids this |
| 404 | Not found, or outside the caller's scope |
| 409 | Conflict (e.g. checking out an asset that is already out) |
| 500 | Server error — details are suppressed in production |

Every mutating request is written to an audit log with the acting user, organization,
site, and before/after values.
