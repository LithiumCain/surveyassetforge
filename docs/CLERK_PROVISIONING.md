# Clerk Auth & Provisioning — How Access Works

"Provisioned" means the API has a row in its own `users` table linked to your
Clerk identity (`clerkUserId`). Signing in through Clerk proves who you are;
provisioning decides whether you belong to a licensed organization and what
role you hold. Clerk is only the identity provider — the app keeps its own
`organizations` table, and a Clerk organization grants nothing until a local
organization is linked to it.

When provisioning fails, the sign-in screen states the reason and the next step
(for example, "accept your invitation first"), and the API logs an
`[auth] provisioning denied ...` line with the same detail.

## The three provisioning paths (checked in order)

1. **Invitation (`saf_*` metadata).** Users invited through the app (Team page →
   *Invite site supervisor*) carry `saf_role` / `saf_org_slug` / `saf_site_id`
   in their Clerk `publicMetadata`. They land with exactly the invited role and
   site. Always honored, even when the allowlist is set.

2. **Clerk organization membership** *(the canonical way)*. Add a user to your
   company's **Organization in the Clerk dashboard** and they are provisioned on
   their next request:
   - `org:admin` → `super_admin`
   - custom Clerk roles named after SAF roles map directly:
     `org:regional_director`, `org:site_supervisor`
   - **anything else, including Clerk's default `org:member` →
     `site_supervisor` with no site**, which sees unassigned inventory only.
     Give them a site or a wider role on the Team page.

   > Members used to default to `regional_director` — fleet-wide read of every
   > asset, cost and site, plus creating sites and inviting people. Wider access
   > is now granted deliberately, never by default.

   A Clerk invitation is **not** a membership until the recipient opens it and
   accepts. An unaccepted invitation grants nothing.

3. **JIT fallback (`CLERK_JIT_ORG_SLUG`).** Signed-in users with no organization
   are dropped into that org with `CLERK_JIT_ROLE` (default `super_admin`).
   Development convenience; allowlist-gated in production.

## Granting access to a director

Either:

- create a custom role named `regional_director` in Clerk (Organizations →
  Roles) and assign it when adding the member, **or**
- add them as an ordinary member, then set their role on the app's Team page.

## Removing access

**Remove them from your organization in the Clerk dashboard.** Their access ends
within about five minutes. The API re-checks each signed-in user against Clerk
and caches the answer for five minutes per server instance. On their next request
they get *"Your access to Survey Asset Forge has been removed"*. Deleting or
banning the user in Clerk works the same way.

Nothing is deleted on our side. Add them back in Clerk and they return with the
same role, site and history, within about 30 seconds.

**Deactivate on the Team page** to shut someone out no matter what Clerk says.
Use this for people invited through the app (*Invite site supervisor*). Those
invitations don't make anyone a member of the Clerk organization, so there is no
membership to remove.

Access is deliberately **kept** in these cases. Each one is logged as
`[auth] access allowed ... only because: <reason>`:

| Reason | Why |
|---|---|
| `clerk_unavailable` | Clerk's API errored or timed out. An outage shouldn't lock every customer out. The check runs again in 30 seconds. |
| `last_super_admin` | They're the organization's only active super admin. Revoking them would leave nobody who can manage the org from inside the app. Promote someone else first. |
| `org_link_stale` | The Clerk organization this org is linked to no longer exists, which usually means the Clerk instance was switched. Relink it with `tenant-doctor --link`. |
| `memberships_truncated` | They belong to more than 100 Clerk organizations. |

People in the seeded placeholder org are never checked. Neither are people in
the `CLERK_JIT_ORG_SLUG` org who are on the allowlist. Neither group has a Clerk
membership to lose.

`CLERK_MEMBERSHIP_CHECK` controls the check (API env var):

- `enforce` (default): revoke as described above.
- `report`: allow, but log `WOULD revoke (report mode)` for each person who would
  lose access. Use this to dry-run before enforcing.
- `off`: emergency kill switch. Turns the check off entirely.

## Linking an organization

A Clerk organization with no local counterpart is a new tenant. On the first
sign-in from it, the API creates a matching local organization — provided the
person signing in passes the allowlist below. After that, every member of that
Clerk organization is provisioned without the allowlist being consulted.

The API **never** relinks an existing, claimed organization to a different Clerk
organization on its own; doing so on an ordinary sign-in let anyone take over a
tenant by creating a Clerk org with its slug. To repoint an organization
deliberately (for example after moving Clerk instances), use:

```bash
DATABASE_URL='<url>' npm exec -w @hartsystem/api -- tsx scripts/tenant-doctor.ts                     # read-only
DATABASE_URL='<url>' npm exec -w @hartsystem/api -- tsx scripts/tenant-doctor.ts \
  --link --clerk-org org_xxx --name "Company" --slug company                                       # write
```

Adopting the seeded placeholder organization on first sign-in is available only
with `CLERK_ORG_ADOPT_SEED=1`, and only while it is still unclaimed.

## The allowlist (`CLERK_JIT_ALLOWED_EMAILS`)

Comma-separated, case-insensitive. Entries are full addresses or whole domains
written with a leading `@`:

```
CLERK_JIT_ALLOWED_EMAILS=@yourcompany.com,partner@example.com
```

It gates **creating** a company — JIT provisioning and linking a new Clerk
organization — not joining one. Membership in an already-linked organization is
exempt; an org admin explicitly added that member.

**In production an empty allowlist means nobody may create a company.** That is
deliberate: creating one grants `super_admin` over it.

## Moving from a Clerk development instance to production

Switching instances (pk_test/sk_test → pk_live/sk_live) gives **every user and
organization a brand-new Clerk ID**.

- **Organizations** must be relinked deliberately with `tenant-doctor --link`
  (see above).
- **Users** are reclaimed **by verified email**: if exactly one active user row
  in the same org has your email but a stale `clerkUserId`, it's relinked to your
  new identity, preserving role, site scope, and audit history.

Checklist when migrating:

1. `surveyassetforge-api` (Vercel): set `CLERK_SECRET_KEY` to the **sk_live**
   key. A pk/sk mismatch between web and API shows up as
   "Invalid or expired session".
2. `surveyassetforge-web` (Vercel): set `VITE_CLERK_PUBLISHABLE_KEY` to the
   **pk_live** key and redeploy — Vite bakes env vars in at build time.
3. In the production Clerk dashboard, create your Organization and add your team.
4. Link the organization with `tenant-doctor --link`, or make sure whoever signs
   in first is on `CLERK_JIT_ALLOWED_EMAILS`.

## Troubleshooting "not provisioned"

| Screen / log reason | Fix |
|---|---|
| Not a member of any organization (`no Clerk org membership and JIT is off`) | Add them to your Clerk Organization as a member — or, if they were invited, have them accept the invitation email. |
| Organization isn't set up yet (`member of N Clerk org(s) but none could be linked`) | Their Clerk org has no local counterpart. Link it with `tenant-doctor --link`, or add a domain or address to `CLERK_JIT_ALLOWED_EMAILS` so their first sign-in creates it. |
| Email not permitted to create a company (`email not on CLERK_JIT_ALLOWED_EMAILS`) | Add the address or its `@domain` to the allowlist and redeploy. |
| Organization no longer exists | The org named by the invitation or `CLERK_JIT_ORG_SLUG` is missing from the database. |
| "Your account has been deactivated" | Reactivate them on the Team page. |
| "Your access ... has been removed" (`access revoked ...: membership_removed`) | They're no longer a member of the Clerk organization this org is linked to. Add them back in Clerk, and access returns within about 30 seconds. |
| "Your sign-in account has been removed or suspended" (`account_removed`) | The Clerk user was deleted or banned. |
| Signed in, but sees only inventory and no sites | Expected for a new member: they are a site supervisor with no site. Assign a site or a role on the Team page. |
