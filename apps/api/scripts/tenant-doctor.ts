/**
 * Tenant doctor — inspect and repair the organization/user tables.
 *
 * Clerk is only the identity provider. The app keeps its own `organizations`
 * table, and a Clerk organization grants access only once a local Organization
 * row carries its `clerkOrgId`. When those drift — a new tenant, or a Clerk
 * dev -> production migration where every id changes — sign-in fails with
 * "not provisioned" even though Clerk looks perfectly correct.
 *
 * Usage (from the repo root):
 *
 *   # Read-only. Shows every org, its Clerk link, and its users.
 *   DATABASE_URL='postgres://...' npm exec -w @hartsystem/api -- tsx scripts/tenant-doctor.ts
 *
 *   # Create a tenant, or point an existing one at a Clerk org.
 *   DATABASE_URL='postgres://...' npm exec -w @hartsystem/api -- tsx scripts/tenant-doctor.ts \
 *     --link --clerk-org org_abc123 --name "Q CELLS" --slug qcells
 *
 * Nothing is written unless --link is passed with all three of its arguments.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const SEED_ORG_PREFIX = 'org_seed_';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const main = async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        users: {
          select: { id: true, email: true, role: true, isActive: true, clerkUserId: true, siteId: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { sites: true, equipment: true } },
      },
    });

    console.log(`\n=== ORGANIZATIONS (${orgs.length}) ===`);
    if (orgs.length === 0) {
      console.log('  none — no tenant exists yet.');
    }

    for (const org of orgs) {
      const unclaimed = org.clerkOrgId.startsWith(SEED_ORG_PREFIX);
      console.log(`\n  ${org.name}  (slug: ${org.slug})`);
      console.log(`    id          ${org.id}`);
      console.log(
        `    clerkOrgId  ${org.clerkOrgId}` +
          (unclaimed ? '   <-- PLACEHOLDER, not linked to a real Clerk org' : ''),
      );
      console.log(`    sites ${org._count.sites} · equipment ${org._count.equipment}`);
      console.log(`    users (${org.users.length}):`);
      for (const u of org.users) {
        const state = u.isActive ? 'active  ' : 'INACTIVE';
        console.log(
          `      ${state} ${(u.email ?? '(no email)').padEnd(34)} ${u.role.padEnd(18)} clerk:${u.clerkUserId}`,
        );
      }
    }

    const placeholders = orgs.filter((o) => o.clerkOrgId.startsWith(SEED_ORG_PREFIX));
    if (placeholders.length === 1) {
      console.log(
        `\n  ! One unclaimed placeholder org exists ("${placeholders[0].slug}"). A first-time sign-in\n` +
          '    from an unlinked Clerk org will ADOPT it rather than creating a new tenant — so a new\n' +
          '    customer would land inside that org and see its data. Link deliberately with --link.',
      );
    }

    if (!flag('link')) {
      console.log('\nRead-only. Pass --link --clerk-org <id> --name <name> --slug <slug> to write.\n');
      return;
    }

    const clerkOrgId = arg('clerk-org');
    const name = arg('name');
    const slug = arg('slug');
    if (!clerkOrgId || !name || !slug) {
      console.error('\n--link requires --clerk-org, --name and --slug.');
      process.exit(1);
    }

    const byClerk = await prisma.organization.findUnique({ where: { clerkOrgId } });
    if (byClerk) {
      console.log(`\nAlready linked: "${byClerk.name}" -> ${clerkOrgId}. Nothing to do.`);
      return;
    }

    const bySlug = await prisma.organization.findUnique({ where: { slug } });
    if (bySlug) {
      const updated = await prisma.organization.update({
        where: { id: bySlug.id },
        data: { clerkOrgId },
      });
      console.log(
        `\nRe-linked existing org "${updated.name}" (${updated.slug})\n` +
          `  ${bySlug.clerkOrgId}  ->  ${clerkOrgId}`,
      );
    } else {
      const created = await prisma.organization.create({
        data: { clerkOrgId, name, slug },
      });
      console.log(`\nCreated tenant "${created.name}" (${created.slug}) linked to ${clerkOrgId}`);
    }

    console.log(
      '\nMembers of that Clerk organization can now sign in. Clerk org:admin becomes super_admin;\n' +
        'other members become regional_director.\n',
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
