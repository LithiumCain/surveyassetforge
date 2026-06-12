#!/usr/bin/env node
/**
 * Reads Survey Asset Tracker.xlsx and inserts sites + assets directly into Postgres.
 * Usage (from repo root):
 *   cd apps/api && npx tsx ../../scripts/import_assets.ts "C:\path\to\Survey Asset Tracker(1).xlsx"
 */

import 'dotenv/config';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { Pool } from 'pg';

// ── helpers ───────────────────────────────────────────────────────────────────

function cleanText(v: unknown): string {
  return String(v ?? '').trim();
}

function textOrNull(v: unknown): string | null {
  const s = cleanText(v);
  return s || null;
}

function parseSheetName(name: string): { code: string; label: string } {
  const cleaned = name.trim();
  const idx = cleaned.indexOf('_');
  if (idx === -1) return { code: '', label: cleaned };
  return { code: cleaned.slice(0, idx).trim(), label: cleaned.slice(idx + 1).trim() };
}

function excelSerialToDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().split('T')[0];
  if (typeof value === 'number' && value > 0) {
    return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

function parseMoney(value: unknown): number {
  const cleaned = String(value ?? '').replace(/[$,]/g, '').trim();
  if (!cleaned || cleaned.toUpperCase() === 'N/A') return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function inferEquipmentType(itemName: string): string {
  const lower = itemName.toLowerCase();
  if (['office', 'business center', 'site prep', 'subscription', 'license'].some(t => lower.includes(t))) return 'Software';
  if (['fc-6400', 'fc-6000', 'tablet', 'controller', 'toughbook'].some(t => lower.includes(t))) return 'Data Collector';
  if (['hiper', 'gnss', 'receiver'].some(t => lower.includes(t))) return 'GNSS';
  if (['radio', '450 mhz', 'satel', 'antenna', 'lmr', 'tnc'].some(t => lower.includes(t))) return 'Radio';
  if (['laptop', 'monitor', 'desktop', 'dock'].some(t => lower.includes(t))) return 'Computer';
  if (['charger', 'battery', 'rod', 'pole', 'bipod', 'tripod', 'tribrach', 'kit', 'cable',
       'adapter', 'case', 'bracket', 'backpack', 'prism', 'bag', 'locater', 'locator',
       'detector', 'hammer'].some(t => lower.includes(t))) return 'Accessory';
  return 'Equipment';
}

function normalizeOwnership(owned: string, rental: string, rpo: string): string {
  if (cleanText(owned).toUpperCase() === 'X') return 'owned';
  if (cleanText(rental).toUpperCase() === 'X') return 'rental';
  if (cleanText(rpo).toUpperCase() === 'X') return 'rpo';
  return 'unknown';
}

// ── import ────────────────────────────────────────────────────────────────────

async function run(workbookPath: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const workbook = XLSX.readFile(workbookPath, { cellDates: true, raw: false });

    console.log(`\nOpened: ${path.basename(workbookPath)}`);
    console.log(`Sheets: ${workbook.SheetNames.join(', ')}\n`);

    await client.query('BEGIN');

    // Wipe existing workbook-backed data
    await client.query('DELETE FROM assets');
    await client.query('DELETE FROM sites');
    console.log('Cleared existing sites and assets.');

    // ── Sites ────────────────────────────────────────────────────────────────
    let siteCount = 0;
    for (const sheetName of workbook.SheetNames) {
      if (sheetName.trim() === '2026 Purchase') continue;
      const { code, label } = parseSheetName(sheetName);
      if (!code || !label) continue;

      await client.query(
        `INSERT INTO sites (name, code)
         VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
        [label, code]
      );
      siteCount++;
    }
    console.log(`Inserted ${siteCount} sites.`);

    // ── Assets ───────────────────────────────────────────────────────────────
    let assetCount = 0;
    let skipped = 0;

    for (const sheetName of workbook.SheetNames) {
      if (sheetName.trim() === '2026 Purchase') continue;
      const { code: siteCode } = parseSheetName(sheetName);
      if (!siteCode) continue;

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

      // Look up the site ID we just inserted
      const siteRes = await client.query<{ id: string }>('SELECT id FROM sites WHERE code = $1', [siteCode]);
      if (siteRes.rows.length === 0) continue;
      const siteId = siteRes.rows[0].id;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const get = (col: number) => row[col] ?? '';

        // Columns: A=0 B=1 C=2 D=3 E=4(rental) F=5(owned) G=6(rpo) H=7 I=8 J=9 K=10 L=11 M=12(assetNum) N=13 O=14
        let manufacturer = cleanText(get(0));
        let itemName = cleanText(get(1));
        const assetNumber = textOrNull(get(12));

        if (!assetNumber) { skipped++; continue; }

        // Armadillo software row shift fix
        if ((!itemName || /^\d+$/.test(itemName)) && manufacturer.toLowerCase().includes('office')) {
          const match = manufacturer.match(/^([A-Za-z0-9/&+ -]+?)\s+(Office.+)$/);
          if (match) { manufacturer = match[1].trim(); itemName = match[2].trim(); }
        }

        if (!itemName) { skipped++; continue; }

        const partNumber = textOrNull(get(2));
        const serialNumber = textOrNull(get(3));
        const subscriptionEndDate = excelSerialToDate(get(7));
        const firmwareVersion = textOrNull(get(8));
        const lastCalibratedDate = excelSerialToDate(get(9));
        const cost = parseMoney(get(10));
        const replacementCost = parseMoney(get(11)) || cost;
        const notes = textOrNull(get(13));
        const vendor = textOrNull(get(14)) || manufacturer || null;
        const ownership = normalizeOwnership(cleanText(get(5)), cleanText(get(4)), cleanText(get(6)));
        const equipmentType = inferEquipmentType(itemName);
        const calibrationStatus = lastCalibratedDate ? 'warning' : 'never_calibrated';

        await client.query(
          `INSERT INTO assets (
            asset_number, part_number, serial_number, item_name, manufacturer, equipment_type,
            site_id, ownership, vendor, firmware_version, latest_firmware_version,
            subscription_end_date, last_calibration_date, calibration_interval_days,
            next_calibration_due, calibration_status, damage_status, asset_notes,
            cost, replacement_cost, source_sheet_name, source_row_number
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,$11,$12,30,NULL,$13,'ok',$14,$15,$16,$17,$18
          )
          ON CONFLICT (asset_number) DO UPDATE SET
            part_number = EXCLUDED.part_number,
            serial_number = EXCLUDED.serial_number,
            item_name = EXCLUDED.item_name,
            manufacturer = EXCLUDED.manufacturer,
            equipment_type = EXCLUDED.equipment_type,
            site_id = EXCLUDED.site_id,
            ownership = EXCLUDED.ownership,
            vendor = EXCLUDED.vendor,
            firmware_version = EXCLUDED.firmware_version,
            subscription_end_date = EXCLUDED.subscription_end_date,
            last_calibration_date = EXCLUDED.last_calibration_date,
            calibration_status = EXCLUDED.calibration_status,
            asset_notes = EXCLUDED.asset_notes,
            cost = EXCLUDED.cost,
            replacement_cost = EXCLUDED.replacement_cost,
            source_sheet_name = EXCLUDED.source_sheet_name,
            source_row_number = EXCLUDED.source_row_number,
            updated_at = NOW()`,
          [
            assetNumber, partNumber, serialNumber, itemName, manufacturer || null, equipmentType,
            siteId, ownership, vendor, firmwareVersion,
            subscriptionEndDate, lastCalibratedDate,
            calibrationStatus, notes,
            cost, replacementCost, sheetName.trim(), i + 1,
          ]
        );
        assetCount++;
      }
      console.log(`  ${sheetName}: ${assetCount} assets so far`);
    }

    await client.query('COMMIT');

    console.log(`\nDone! ${siteCount} sites, ${assetCount} assets imported. (${skipped} empty rows skipped)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nImport failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const workbookArg = process.argv.slice(2).find(a => !a.startsWith('--'));

if (!workbookArg) {
  console.error('Usage: npx tsx import_assets.ts <workbook.xlsx>');
  process.exit(1);
}

const workbookPath = path.resolve(workbookArg);
if (!fs.existsSync(workbookPath)) {
  console.error(`File not found: ${workbookPath}`);
  process.exit(1);
}

run(workbookPath);
