import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // ============================
  // 0. CREATE ASSETS TABLE
  // ============================
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      asset_number TEXT NOT NULL UNIQUE,
      part_number TEXT,
      serial_number TEXT,
      item_name TEXT NOT NULL,
      manufacturer TEXT,
      equipment_type TEXT NOT NULL,
      site_id TEXT NOT NULL REFERENCES sites(id),
      ownership TEXT NOT NULL DEFAULT 'unknown',
      assigned_name TEXT,
      employee_number TEXT,
      vendor TEXT,
      firmware_version VARCHAR(128),
      latest_firmware_version VARCHAR(128),
      subscription_end_date DATE,
      last_calibration_date DATE,
      calibration_interval_days INTEGER NOT NULL DEFAULT 30,
      next_calibration_due DATE,
      calibration_status TEXT NOT NULL DEFAULT 'never_calibrated',
      damage_status TEXT NOT NULL DEFAULT 'ok',
      damage_type TEXT,
      asset_notes TEXT,
      repair_notes TEXT,
      estimated_repair_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      replacement_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      acquired_date DATE,
      source_sheet_name TEXT,
      source_row_number INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

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
