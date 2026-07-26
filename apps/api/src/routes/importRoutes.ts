import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditFromRequest } from '../services/audit.js';
import { computeCalibrationStatus, computeNextCalibrationDue } from '../services/calibration.js';

// Bulk workbook import. The client parses the Excel workbook locally and sends
// normalized rows; the server upserts sites and inserts equipment, skipping
// asset numbers that already exist in the organization (safe to re-run).

const IMPORT_CALIBRATION_INTERVAL_DAYS = 90;

const importSchema = z.object({
  sites: z
    .array(
      z.object({
        code: z.string().min(1).max(24),
        name: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(150),
  assets: z
    .array(
      z.object({
        // null => into inventory (unassigned gear, e.g. purchase-list items)
        siteCode: z.string().min(1).max(24).nullable(),
        assetNumber: z.string().min(2).max(64),
        itemName: z.string().min(1).max(240),
        equipmentType: z.string().min(1).max(60),
        manufacturer: z.string().max(120).optional().nullable(),
        partNumber: z.string().max(120).optional().nullable(),
        serialNumber: z.string().max(120).optional().nullable(),
        ownership: z.enum(['owned', 'rental', 'rpo', 'unknown']).default('unknown'),
        firmwareVersion: z.string().max(128).optional().nullable(),
        subscriptionEndDate: z.string().date().optional().nullable(),
        lastCalibrationDate: z.string().date().optional().nullable(),
        cost: z.number().min(0).default(0),
        replacementCost: z.number().min(0).default(0),
        notes: z.string().max(2000).optional().nullable(),
        sourceSheetName: z.string().max(120).optional().nullable(),
        sourceRowNumber: z.number().int().optional().nullable(),
      }),
    )
    .min(1)
    .max(5000),
});

const dateOnlyToDate = (value: string | null | undefined): Date | null =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;

export const importRoutes = Router();

importRoutes.use(authenticate);

importRoutes.post('/import/workbook', authorize('super_admin'), async (req, res, next) => {
  try {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid import payload', issues: parsed.error.issues });
    }
    const { sites, assets } = parsed.data;
    const organizationId = req.user!.organizationId;

    // Upsert sites by (org, code) so a re-import refreshes names, never
    // duplicates. Batched in one transaction — one network round trip instead
    // of N sequential queries (matters inside a serverless time budget).
    const upsertedSites = await prisma.$transaction(
      sites.map((s) =>
        prisma.site.upsert({
          where: { organizationId_code: { organizationId, code: s.code } },
          update: { name: s.name },
          create: { organizationId, code: s.code, name: s.name, status: 'active' },
        }),
      ),
    );
    const siteIdByCode = new Map<string, string>(upsertedSites.map((s) => [s.code, s.id]));

    const rows = [];
    let missingSite = 0;
    for (const a of assets) {
      const siteId = a.siteCode === null ? null : siteIdByCode.get(a.siteCode);
      if (siteId === undefined) {
        missingSite += 1;
        continue;
      }
      const nextDueIso = computeNextCalibrationDue(
        a.lastCalibrationDate ?? null,
        IMPORT_CALIBRATION_INTERVAL_DAYS,
      );
      rows.push({
        organizationId,
        siteId,
        assetNumber: a.assetNumber,
        itemName: a.itemName,
        equipmentType: a.equipmentType,
        manufacturer: a.manufacturer ?? null,
        partNumber: a.partNumber ?? null,
        serialNumber: a.serialNumber ?? null,
        ownership: a.ownership,
        vendor: a.manufacturer ?? null,
        firmwareVersion: a.firmwareVersion ?? null,
        subscriptionEndDate: dateOnlyToDate(a.subscriptionEndDate),
        lastCalibrationDate: dateOnlyToDate(a.lastCalibrationDate),
        calibrationIntervalDays: IMPORT_CALIBRATION_INTERVAL_DAYS,
        nextCalibrationDue: dateOnlyToDate(nextDueIso),
        calibrationStatus: computeCalibrationStatus(nextDueIso),
        cost: a.cost,
        replacementCost: a.replacementCost || a.cost,
        assetNotes: a.notes ?? null,
        sourceSheetName: a.sourceSheetName ?? null,
        sourceRowNumber: a.sourceRowNumber ?? null,
      });
    }

    // skipDuplicates rides the (organizationId, assetNumber) unique constraint,
    // so re-importing the same workbook is a no-op for existing gear.
    const created = await prisma.equipment.createMany({ data: rows, skipDuplicates: true });
    const skipped = rows.length - created.count + missingSite;

    await auditFromRequest(req, {
      action: 'equipment.imported',
      entityType: 'equipment',
      entityId: 'workbook-import',
      field: 'count',
      newValue: String(created.count),
      metadata: {
        sites: sites.length,
        submitted: assets.length,
        created: created.count,
        skipped,
      },
    });

    return res.status(201).json({
      sites: sites.length,
      created: created.count,
      skipped,
    });
  } catch (err) {
    next(err);
  }
});
