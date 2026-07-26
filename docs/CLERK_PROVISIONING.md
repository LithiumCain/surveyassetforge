# Clerk Auth & Provisioning — How Access Works

"Provisioned" means the API has a row in its own `users` table linked to your
Clerk identity (`clerkUserId`). Signing in through Clerk proves who you are;
provisioning decides whether you belong to a licensed organization and what
role you hold. The screen **"Your account is not provisioned for Survey Asset
Forge"** means Clerk verified you fine, but no provisioning path matched.

## The three provisioning paths (checked in order)

1. **Invitation (`saf_*` metadata).** Users invited through the app carry
   `saf_role` / `saf_org_slug` / `saf_site_id` in their Clerk `publicMetadata`
   (stamped on the invitation). They land with exactly the invited role and
   site. Always honored, even when the allowlist is set.

2. **Clerk organization membership** *(the canonical way)*. Add a user to your
   company's **Organization in the Clerk dashboard** (or via the app) and they
   are provisioned on their next request:
   - Clerk org role `org:admin` → `super_admin`
   - custom Clerk roles named after SAF roles (e.g. `org:site_supervisor`)
     map directly
   - any other role (incl. `org:member`) → `regional_director`

   The Clerk org is matched to a local organization by `clerkOrgId`. If no org
   is linked yet, the API will **claim** one automatically (allowlist-gated,
   see below): first by matching slug, then by adopting the sole unclaimed
   (seed-placeholder) org, and finally by creating a brand-new tenant that
   mirrors the Clerk org.

3. **JIT fallback (`CLERK_JIT_ORG_SLUG`).** Any signed-in user is dropped into
   that org with `CLERK_JIT_ROLE` (default `super_admin`). Dev convenience;
   allowlist-gated in production.

## The allowlist (`CLERK_JIT_ALLOWED_EMAILS`)

Comma-separated emails. When set, it gates every path that **claims tenancy**:
JIT provisioning, and linking/creating an organization from a Clerk org.
Membership in an **already-linked** org is exempt — an org admin explicitly
added that member, which is the trust signal we want.

## Moving from a Clerk development instance to production

Switching instances (pk_test/sk_test → pk_live/sk_live) gives **every user and
organization a brand-new Clerk ID**. The API self-heals:

- **Organizations** re-link automatically the first time a member signs in
  (slug match or sole-unclaimed-org adoption, allowlist-gated).
- **Users** are reclaimed **by email**: if an active user row in the same org
  has your email but a stale `clerkUserId`, it's relinked to your new identity,
  preserving role, site scope, and audit history.

Checklist when migrating:

1. `surveyassetforge-api` (Vercel): set `CLERK_SECRET_KEY` to the **sk_live**
   key. A pk/sk mismatch between web and API shows up as
   "Invalid or expired session".
2. `surveyassetforge-web` (Vercel): set `VITE_CLERK_PUBLISHABLE_KEY` to the
   **pk_live** key (and redeploy — Vite bakes env vars at build time).
3. In the production Clerk dashboard, create your Organization and add your
   team as members (admins get `super_admin`).
4. If `CLERK_JIT_ALLOWED_EMAILS` is set, make sure it contains the emails of
   whoever signs in **first** for each org (they trigger the org linking).
   Everyone added to the org afterwards gets in without being on the list.

## Troubleshooting "not provisioned"

The API logs a `[auth] provisioning denied ...` line (Vercel → Logs) with the
exact reason for every denial:

| Log reason | Fix |
|---|---|
| `no Clerk org membership and JIT is off` | Add the user to your Clerk Organization (dashboard → Organizations → Members), or set `CLERK_JIT_ORG_SLUG`. |
| `member of N Clerk org(s) but none could be linked (allowlist?)` | Their email isn't on `CLERK_JIT_ALLOWED_EMAILS` and no local org is linked to that Clerk org yet. Add their email to the allowlist (or have an allowlisted teammate sign in first to link the org). |
| `email not on CLERK_JIT_ALLOWED_EMAILS` | Add the email (exact match, case-insensitive) to the env var and redeploy. |
| `JIT org "…" not found` / `invited org "…" not found` | The org slug in the env var / invitation doesn't exist in the database. |
| No denial logged, still 401 | The user row exists but `isActive` is false — reactivate it. |
