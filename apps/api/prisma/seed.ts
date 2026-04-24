import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // ============================
  // 1. TEMP PASSWORD FOR ALL SITES
  // ============================
  const tempPassword = 'Password123!';
  const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

  // ============================
  // 2. ALL SITES FROM EXCEL
  // ============================
  const siteCodes = [
    "0273_Armadillo",
    "0247_Atlas IV",
    "0249_Atlas VI",
    "0250_Atlas X",
    "0255_Atlas II",
    "0257_Blossom",
    "0258_Ursa",
    "0272_Atlas XI",
    "0275_Atlas V",
    "Armadillo Solar",
    "Eagle Creek Solar",
    "Clear Fork Creek Solar",
    "Switchgrass Solar",
    "Great Plains Solar"
  ];

  for (const code of siteCodes) {
    await prisma.site.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code,
        tempPasswordHash
      }
    });
  }

  // ============================
  // 3. SITE SUPERVISORS
  // ============================
  const sites = await prisma.site.findMany();
  for (const site of sites) {
    const siteId = site.code.split('_')[0]; // e.g., "0273"
    const username = `${siteId}_supervisor`;
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        internalEmail: `${username}@surveyassetforge.local`,
        passwordHash: tempPasswordHash,
        role: 'site_supervisor',
        siteId: site.id
      }
    });
  }

  // ============================
  // 4. SUPER ADMINS
  // ============================
  const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 10);

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      internalEmail: 'superadmin@surveyassetforge.local',
      passwordHash: superAdminPassword,
      role: 'super_admin'
    }
  });

  await prisma.user.upsert({
    where: { username: 'james' },
    update: {},
    create: {
      username: 'james',
      internalEmail: 'james@surveyassetforge.local',
      passwordHash: superAdminPassword,
      role: 'super_admin'
    }
  });

  // ============================
  // 5. REGIONAL DIRECTOR (J. HARTLEY)
  // ============================
  const rdPassword = await bcrypt.hash('Hartley123!', 10);

  await prisma.user.upsert({
    where: { username: 'jhartley' },
    update: {},
    create: {
      username: 'jhartley',
      internalEmail: 'jhartley@surveyassetforge.local',
      passwordHash: rdPassword,
      role: 'regional_director'
    }
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
