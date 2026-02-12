# Repository Guidelines

## Project Structure & Module Organization
This repository is a Retool app source export centered on `.rsx` screens and JS query logic.
- `main.rsx`: app entry point; includes global functions, screens, and header.
- `functions.rsx`: global app state (`equipmentData`, `currentUser`).
- `header.rsx`: shared top navigation.
- `src/*.rsx`: screen and UI modules (`page1`, `adminDashboard`, `siteDashboard`, modal and KPI includes).
- `lib/*.js`: business logic for filters, computed data, and CRUD-style UI scripts.
- `.positions/*.json`: editor layout metadata; avoid manual edits unless resolving layout issues.

## Build, Test, and Development Commands
There is no local build pipeline in this repo (no `package.json`/`Makefile`). Use Retool preview for runtime validation.
- `rg --files src lib`: quick inventory of editable modules.
- `rg "TODO|FIXME|showNotification" lib src`: find hotspots and user-facing logic.
- `wc -l src/*.rsx lib/*.js`: quick scope check before larger refactors.

## Coding Style & Naming Conventions
- Use 2-space indentation in both `.rsx` and `.js` files.
- Keep component/query IDs descriptive and camelCase (e.g., `clearCalibFiltersScript`, `equipmentTableContainer`).
- Name JS helpers by behavior: `filtered*.js`, `clear*Script.js`, `*Notification.js`.
- Keep JS logic side-effect aware: compute first, then update Retool state/components (`setValue`, `setHidden`, notifications).
- Prefer small, focused includes in `src/` over very large single-screen files.

## Testing Guidelines
Automated tests are not configured in this repository.
- Validate changes in Retool preview for all impacted screens.
- Verify filter behavior, table data updates, and modal flows after each JS change.
- For date/math logic (`moment()` usage), test at least one boundary case (e.g., 20/21/30/31 day thresholds).

## Commit & Pull Request Guidelines
Git history is not available in this folder, so use a clear convention going forward.
- Commit format: `type(scope): summary` (example: `fix(calibration): correct warning threshold`).
- Keep commits focused to one feature/fix area (`src/` UI vs `lib/` logic).
- PRs should include: purpose, affected files, manual test steps, and screenshots/GIFs for UI changes.
- Link related issue/ticket IDs when available.

## Security & Configuration Tips
- Do not commit real employee or asset identifiers; keep sample/test-safe data only.
- Avoid embedding secrets in `lib/*.js`; use Retool resources/environment settings for sensitive values.
