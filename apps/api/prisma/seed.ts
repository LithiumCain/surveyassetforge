// =============================================================================
// Survey Asset Forge (SAF) — Database Seed
// -----------------------------------------------------------------------------
// Builds a self-contained DEMO tenant so we have something realistic to look at
// while developing. 100% fictional — no real companies, people, or sites.
//
// Shows off the real-world shapes from discovery: an inactive (historical) site,
// gear sitting in inventory (no site), a disposed item, and calibration history.
//
// Idempotent: safe to run repeatedly (uses upserts).
//
// NOTE on users: until Clerk is wired, each user gets a PLACEHOLDER
// `clerkUserId` ("user_seed_*"). When Clerk goes live we'll link these rows to
// real Clerk accounts (or re-seed).
// =============================================================================

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {
  computeNextCalibrationDue,
  computeCalibrationStatus,
  isoDate,
} from '../src/services/calibration.js';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return new Date(`${isoDate(d)}T00:00:00.000Z`);
};

type EquipmentStatusSeed = 'active' | 'sold' | 'lost' | 'stolen' | 'written_off';

async function main() {
  // ===========================================================================
  // 1. ORGANIZATION
  // ===========================================================================
  const org = await prisma.organization.upsert({
    where: { slug: 'faeheart-survey-co' },
    update: { name: 'Faeheart Survey Co' },
    create: { name: 'Faeheart Survey Co', slug: 'faeheart-survey-co', clerkOrgId: 'org_seed_faeheart' },
  });

  // ===========================================================================
  // 2. SITES (3 active + 1 inactive/historical)
  // ===========================================================================
  const siteSeed = [
    { code: 'NVY', name: 'North Valley Yard', city: 'Boulder', state: 'CO', status: 'active' as const },
    { code: 'SRD', name: 'South Ridge Depot', city: 'Santa Fe', state: 'NM', status: 'active' as const },
    { code: 'EPF', name: 'East Plains Field Office', city: 'Amarillo', state: 'TX', status: 'active' as const },
    { code: 'RYD', name: 'Retired Yard (closed)', city: 'Lubbock', state: 'TX', status: 'inactive' as const },
  ];

  const sites: Record<string, string> = {};
  for (const s of siteSeed) {
    const site = await prisma.site.upsert({
      where: { organizationId_code: { organizationId: org.id, code: s.code } },
      update: { name: s.name, city: s.city, state: s.state, status: s.status },
      create: { organizationId: org.id, ...s },
    });
    sites[s.code] = site.id;
  }

  // ===========================================================================
  // 3. USERS (one per role; fictional people)
  // ===========================================================================
  const userSeed = [
    { clerkUserId: 'user_seed_admin',    email: 'admin@faeheart.example',    firstName: 'Riley',  lastName: 'Quinn',  role: 'super_admin' as const,       siteCode: null },
    { clerkUserId: 'user_seed_director', email: 'director@faeheart.example', firstName: 'Morgan', lastName: 'Lee',    role: 'regional_director' as const, siteCode: null },
    { clerkUserId: 'user_seed_sup_nvy',  email: 'avery@faeheart.example',    firstName: 'Avery',  lastName: 'Stone',  role: 'site_supervisor' as const,   siteCode: 'NVY' },
    { clerkUserId: 'user_seed_sup_srd',  email: 'jordan@faeheart.example',   firstName: 'Jordan', lastName: 'Cruz',   role: 'site_supervisor' as const,   siteCode: 'SRD' },
    { clerkUserId: 'user_seed_sup_epf',  email: 'sam@faeheart.example',      firstName: 'Sam',    lastName: 'Rivera', role: 'site_supervisor' as const,   siteCode: 'EPF' },
  ];

  const usersByClerk: Record<string, string> = {};
  for (const u of userSeed) {
    const user = await prisma.user.upsert({
      where: { clerkUserId: u.clerkUserId },
      update: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role },
      create: {
        organizationId: org.id,
        clerkUserId: u.clerkUserId,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        siteId: u.siteCode ? sites[u.siteCode] : null,
      },
    });
    usersByClerk[u.clerkUserId] = user.id;
  }

  // ===========================================================================
  // 4. EQUIPMENT (~16 items: every calibration state, inventory, a disposal)
  // ===========================================================================
  type Item = {
    assetNumber: string;
    itemName: string;
    equipmentType: string;
    manufacturer: string;
    siteCode: string | null; // null => in inventory (unassigned)
    ownership: 'owned' | 'rental' | 'rpo' | 'unknown';
    lastCalDaysAgo: number | null;
    intervalDays: number;
    cost: number;
    replacementCost: number;
    estimatedRepairCost: number;
    damageStatus: 'ok' | 'reported' | 'under_repair';
    damageType: string | null;
    firmwareVersion: string | null;
    latestFirmwareVersion: string | null;
    status?: EquipmentStatusSeed;
    dispositionNotes?: string;
  };

  const items: Item[] = [
    { assetNumber: 'SAF-GNSS-001', itemName: 'GNSS Base Receiver',  equipmentType: 'GNSS Receiver', manufacturer: 'Trimble', siteCode: 'NVY', ownership: 'owned',  lastCalDaysAgo: 5,    intervalDays: 90, cost: 18500, replacementCost: 21000, estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: '6.21', latestFirmwareVersion: '6.21' },
    { assetNumber: 'SAF-GNSS-002', itemName: 'GNSS Rover Receiver', equipmentType: 'GNSS Receiver', manufacturer: 'Trimble', siteCode: 'NVY', ownership: 'owned',  lastCalDaysAgo: 70,   intervalDays: 90, cost: 16900, replacementCost: 19500, estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: '6.18', latestFirmwareVersion: '6.21' },
    { assetNumber: 'SAF-TS-010',   itemName: 'Robotic Total Station', equipmentType: 'Total Station', manufacturer: 'Leica', siteCode: 'NVY', ownership: 'rental', lastCalDaysAgo: 85,   intervalDays: 90, cost: 32000, replacementCost: 36000, estimatedRepairCost: 1200, damageStatus: 'reported',    damageType: 'Tribrach play',  firmwareVersion: '4.10', latestFirmwareVersion: '4.12' },
    { assetNumber: 'SAF-TS-011',   itemName: 'Manual Total Station',  equipmentType: 'Total Station', manufacturer: 'Leica', siteCode: 'SRD', ownership: 'owned',  lastCalDaysAgo: 200,  intervalDays: 90, cost: 14500, replacementCost: 17000, estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: '4.12', latestFirmwareVersion: '4.12' },
    { assetNumber: 'SAF-DC-020',   itemName: 'Field Data Collector', equipmentType: 'Data Collector', manufacturer: 'Carlson', siteCode: 'SRD', ownership: 'owned', lastCalDaysAgo: 25, intervalDays: 30, cost: 4200,  replacementCost: 5000,  estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: '2.3',  latestFirmwareVersion: '2.3' },
    { assetNumber: 'SAF-DC-021',   itemName: 'Field Data Collector', equipmentType: 'Data Collector', manufacturer: 'Carlson', siteCode: 'EPF', ownership: 'rpo',   lastCalDaysAgo: 10, intervalDays: 30, cost: 4200,  replacementCost: 5000,  estimatedRepairCost: 3800, damageStatus: 'under_repair', damageType: 'Cracked screen', firmwareVersion: '2.1',  latestFirmwareVersion: '2.3' },
    { assetNumber: 'SAF-TAB-030',  itemName: 'Rugged Field Tablet',  equipmentType: 'Tablet', manufacturer: 'Panasonic', siteCode: 'EPF', ownership: 'owned',  lastCalDaysAgo: null, intervalDays: 30, cost: 2600,  replacementCost: 2900,  estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: null,   latestFirmwareVersion: null },
    { assetNumber: 'SAF-RAD-040',  itemName: 'UHF Radio Modem',      equipmentType: 'Radio', manufacturer: 'Pacific Crest', siteCode: 'SRD', ownership: 'owned', lastCalDaysAgo: 110, intervalDays: 90, cost: 1900,  replacementCost: 2200,  estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: '1.4',  latestFirmwareVersion: '1.4' },
    { assetNumber: 'SAF-LVL-050',  itemName: 'Digital Level',        equipmentType: 'Level', manufacturer: 'Leica',  siteCode: 'EPF', ownership: 'owned',  lastCalDaysAgo: 15,   intervalDays: 60, cost: 6800,  replacementCost: 7500,  estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: '3.0',  latestFirmwareVersion: '3.0' },
    { assetNumber: 'SAF-PRsm-060', itemName: 'Prism & Pole Kit',     equipmentType: 'Prism', manufacturer: 'Seco',   siteCode: 'SRD', ownership: 'owned',  lastCalDaysAgo: 3,    intervalDays: 180, cost: 850,  replacementCost: 950,   estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: null,   latestFirmwareVersion: null },
    { assetNumber: 'SAF-TRP-070',  itemName: 'Heavy-Duty Tripod',    equipmentType: 'Tripod', manufacturer: 'Seco',  siteCode: 'EPF', ownership: 'owned',  lastCalDaysAgo: 365,  intervalDays: 365, cost: 420,  replacementCost: 480,   estimatedRepairCost: 0,    damageStatus: 'ok',          damageType: null,             firmwareVersion: null,   latestFirmwareVersion: null },
    { assetNumber: 'SAF-GNSS-003', itemName: 'GNSS Rover Receiver',  equipmentType: 'GNSS Receiver', manufacturer: 'Septentrio', siteCode: 'EPF', ownership: 'owned', lastCalDaysAgo: 95, intervalDays: 90, cost: 15200, replacementCost: 18000, estimatedRepairCost: 0, damageStatus: 'ok', damageType: null, firmwareVersion: '5.5', latestFirmwareVersion: '5.5' },
    // In inventory (no site) — returned to stock, awaiting redeployment:
    { assetNumber: 'SAF-GNSS-004', itemName: 'GNSS Rover Receiver',  equipmentType: 'GNSS Receiver', manufacturer: 'Trimble', siteCode: null, ownership: 'owned', lastCalDaysAgo: 40, intervalDays: 90, cost: 16900, replacementCost: 19500, estimatedRepairCost: 0, damageStatus: 'ok', damageType: null, firmwareVersion: '6.21', latestFirmwareVersion: '6.21' },
    { assetNumber: 'SAF-TAB-031',  itemName: 'Rugged Field Tablet',  equipmentType: 'Tablet', manufacturer: 'Panasonic', siteCode: null, ownership: 'owned', lastCalDaysAgo: null, intervalDays: 30, cost: 2600, replacementCost: 2900, estimatedRepairCost: 0, damageStatus: 'ok', damageType: null, firmwareVersion: null, latestFirmwareVersion: null },
    // Historical item at the retired site:
    { assetNumber: 'SAF-TS-009',   itemName: 'Legacy Total Station', equipmentType: 'Total Station', manufacturer: 'Topcon', siteCode: 'RYD', ownership: 'owned', lastCalDaysAgo: 400, intervalDays: 90, cost: 9000, replacementCost: 12000, estimatedRepairCost: 0, damageStatus: 'ok', damageType: null, firmwareVersion: '3.1', latestFirmwareVersion: '3.4' },
    // Disposed (sold) — kept for history, hidden from active lists:
    { assetNumber: 'SAF-DC-019',   itemName: 'Field Data Collector', equipmentType: 'Data Collector', manufacturer: 'Carlson', siteCode: null, ownership: 'owned', lastCalDaysAgo: 300, intervalDays: 30, cost: 4200, replacementCost: 5000, estimatedRepairCost: 0, damageStatus: 'ok', damageType: null, firmwareVersion: '2.0', latestFirmwareVersion: '2.3', status: 'sold', dispositionNotes: 'Sold to a subcontractor, 2025.' },
  ];

  const acquiredBase = daysFromNow(-400);
  const equipmentByAsset: Record<string, string> = {};

  for (const it of items) {
    const lastCal = it.lastCalDaysAgo === null ? null : daysFromNow(-it.lastCalDaysAgo);
    const lastCalIso = lastCal ? isoDate(lastCal) : null;
    const nextDueIso = computeNextCalibrationDue(lastCalIso, it.intervalDays);
    const status = computeCalibrationStatus(nextDueIso);

    const eq = await prisma.equipment.upsert({
      where: { organizationId_assetNumber: { organizationId: org.id, assetNumber: it.assetNumber } },
      update: {},
      create: {
        organizationId: org.id,
        siteId: it.siteCode ? sites[it.siteCode] : null,
        assetNumber: it.assetNumber,
        itemName: it.itemName,
        equipmentType: it.equipmentType,
        manufacturer: it.manufacturer,
        ownership: it.ownership,
        vendor: it.manufacturer,
        firmwareVersion: it.firmwareVersion,
        latestFirmwareVersion: it.latestFirmwareVersion,
        lastCalibrationDate: lastCal,
        calibrationIntervalDays: it.intervalDays,
        nextCalibrationDue: nextDueIso ? new Date(`${nextDueIso}T00:00:00.000Z`) : null,
        calibrationStatus: status,
        damageStatus: it.damageStatus,
        damageType: it.damageType,
        estimatedRepairCost: it.estimatedRepairCost,
        cost: it.cost,
        replacementCost: it.replacementCost,
        acquiredDate: acquiredBase,
        status: it.status ?? 'active',
        dispositionNotes: it.dispositionNotes ?? null,
      },
    });
    equipmentByAsset[it.assetNumber] = eq.id;
  }

  // ===========================================================================
  // 5. CALIBRATION HISTORY (a couple of logged events, with the on-site user)
  // ===========================================================================
  if ((await prisma.calibrationRecord.count()) === 0) {
    const history = [
      { asset: 'SAF-GNSS-001', daysAgo: 5,  by: 'user_seed_sup_nvy', notes: 'Routine field calibration.' },
      { asset: 'SAF-DC-020',   daysAgo: 25, by: 'user_seed_sup_srd', notes: 'Calibrated after firmware update.' },
    ];
    for (const h of history) {
      await prisma.calibrationRecord.create({
        data: {
          organizationId: org.id,
          equipmentId: equipmentByAsset[h.asset],
          calibratedDate: daysFromNow(-h.daysAgo),
          calibratedById: usersByClerk[h.by],
          notes: h.notes,
        },
      });
    }
  }

  const counts = {
    organizations: await prisma.organization.count(),
    sites: await prisma.site.count(),
    users: await prisma.user.count(),
    equipment: await prisma.equipment.count(),
    calibrationRecords: await prisma.calibrationRecord.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
