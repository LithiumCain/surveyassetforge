import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditFromRequest } from '../services/audit.js';
import {
  computeCalibrationStatus,
  computeCurrentValue,
  computeNextCalibrationDue,
  shouldRecommendReplacement,
} from '../services/calibration.js';

const assetSchema = z.object({
  assetNumber: z.string().min(2),
  partNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  itemName: z.string().min(1),
  manufacturer: z.string().optional().nullable(),
  equipmentType: z.string().min(1),
  // null/omitted => "in inventory" (unassigned).
  siteId: z.string().uuid().optional().nullable(),
  ownership: z.enum(['owned', 'rental', 'rpo', 'unknown']).default('unknown'),
  assignedName: z.string().optional().nullable(),
  employeeNumber: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  firmwareVersion: z.string().max(128).optional().nullable(),
  latestFirmwareVersion: z.string().max(128).optional().nullable(),
  subscriptionEndDate: z.string().date().optional().nullable(),
  lastCalibrationDate: z.string().date().optional().nullable(),
  calibrationIntervalDays: z.number().int().min(1).max(365),
  damageStatus: z.enum(['ok', 'reported', 'under_repair']),
  damageType: z.string().optional().nullable(),
  assetNotes: z.string().optional().nullable(),
  repairNotes: z.string().optional().nullable(),
  estimatedRepairCost: z.number().min(0),
  cost: z.number().min(0),
  replacementCost: z.number().min(0),
  acquiredDate: z.string().date().optional().nullable(),
});

const scanSchema = z.object({ assetNumber: z.string().min(2) });

const disposeSchema = z.object({
  status: z.enum(['sold', 'lost', 'stolen', 'written_off']).default('written_off'),
  notes: z.string().max(500).optional().nullable(),
});

const calibrationSchema = z.object({
  calibratedDate: z.string().date(),
  notes: z.string().max(500).optional().nullable(),
  photoUrl: z.string().url().max(1000).optional().nullable(),
});

type EquipmentWithSite = Prisma.EquipmentGetPayload<{ include: { site: true } }>;

const toDateOnly = (value: Date | null): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const dateOnlyToDate = (value: string | null | undefined): Date | null =>
  value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null;

const toDto = (e: EquipmentWithSite) => {
  const cost = Number(e.cost);
  const replacementCost = Number(e.replacementCost);
  const estimatedRepairCost = Number(e.estimatedRepairCost);
  const acquiredDate = toDateOnly(e.acquiredDate);

  return {
    id: e.id,
    assetId: e.id,
    assetNumber: e.assetNumber,
    partNumber: e.partNumber,
    serialNumber: e.serialNumber,
    itemName: e.itemName,
    manufacturer: e.manufacturer,
    equipmentType: e.equipmentType,
    siteId: e.siteId,
    siteName: e.site?.name ?? null, // null => in inventory
    inInventory: e.siteId === null,
    ownership: e.ownership,
    assignedName: e.assignedName,
    employeeNumber: e.employeeNumber,
    vendor: e.vendor,
    firmwareVersion: e.firmwareVersion,
    latestFirmwareVersion: e.latestFirmwareVersion,
    firmwareOutdated: !!e.latestFirmwareVersion && e.latestFirmwareVersion !== e.firmwareVersion,
    subscriptionEndDate: toDateOnly(e.subscriptionEndDate),
    lastCalibrationDate: toDateOnly(e.lastCalibrationDate),
    calibrationIntervalDays: e.calibrationIntervalDays,
    nextCalibrationDue: toDateOnly(e.nextCalibrationDue),
    calibrationStatus: e.calibrationStatus,
    damageStatus: e.damageStatus,
    damageType: e.damageType,
    assetNotes: e.assetNotes,
    repairNotes: e.repairNotes,
    estimatedRepairCost,
    cost,
    replacementCost,
    currentValue: computeCurrentValue(cost, acquiredDate),
    replacementRecommended: shouldRecommendReplacement(estimatedRepairCost, replacementCost),
    status: e.status,
    dispositionNotes: e.dispositionNotes,
    acquiredDate,
    sourceSheetName: e.sourceSheetName,
    sourceRowNumber: e.sourceRowNumber,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
};

// Base org-scope for the caller. Supervisors are further limited to their site.
// Only "active" equipment is listed; disposed items are kept but hidden.
const listScope = (req: Request): Prisma.EquipmentWhereInput => {
  const where: Prisma.EquipmentWhereInput = {
    organizationId: req.user!.organizationId,
    status: 'active',
  };
  if (req.user!.role === 'site_supervisor' && req.user!.siteId) {
    where.siteId = req.user!.siteId;
  }
  return where;
};

export const assetRoutes = Router();

assetRoutes.use(authenticate);

assetRoutes.get('/assets', async (req, res, next) => {
  try {
    const rows = await prisma.equipment.findMany({
      where: listScope(req),
      include: { site: true },
      orderBy: { assetNumber: 'asc' },
    });
    res.json(rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

assetRoutes.get('/assets/:id', async (req, res, next) => {
  try {
    const row = await prisma.equipment.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { site: true },
    });
    if (!row) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    if (req.user!.role === 'site_supervisor' && row.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json(toDto(row));
  } catch (err) {
    next(err);
  }
});

// Resolve + validate the site for a write. Returns the siteId to persist, or a
// string error message. Supervisors are pinned to their own site; admins may
// pass null to place gear in inventory.
const resolveSiteForWrite = async (
  req: Request,
  siteId: string | null,
): Promise<{ siteId: string | null } | { error: string }> => {
  if (req.user!.role === 'site_supervisor') {
    if (!siteId || siteId !== req.user!.siteId) {
      return { error: 'Field users can only manage assets at their own site' };
    }
  }
  if (siteId) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId: req.user!.organizationId },
    });
    if (!site) {
      return { error: 'Unknown site for this organization' };
    }
  }
  return { siteId: siteId ?? null };
};

assetRoutes.post('/assets', authorize('super_admin', 'site_supervisor'), async (req, res, next) => {
  try {
    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
    }
    const data = parsed.data;

    const resolved = await resolveSiteForWrite(req, data.siteId ?? null);
    if ('error' in resolved) {
      return res.status(req.user!.role === 'site_supervisor' ? 403 : 400).json({ message: resolved.error });
    }

    const nextDueIso = computeNextCalibrationDue(
      data.lastCalibrationDate ?? null,
      data.calibrationIntervalDays,
    );

    try {
      const created = await prisma.equipment.create({
        data: {
          organizationId: req.user!.organizationId,
          siteId: resolved.siteId,
          assetNumber: data.assetNumber,
          partNumber: data.partNumber ?? null,
          serialNumber: data.serialNumber ?? null,
          itemName: data.itemName,
          manufacturer: data.manufacturer ?? null,
          equipmentType: data.equipmentType,
          ownership: data.ownership,
          vendor: data.vendor ?? null,
          firmwareVersion: data.firmwareVersion ?? null,
          latestFirmwareVersion: data.latestFirmwareVersion ?? null,
          subscriptionEndDate: dateOnlyToDate(data.subscriptionEndDate),
          lastCalibrationDate: dateOnlyToDate(data.lastCalibrationDate),
          calibrationIntervalDays: data.calibrationIntervalDays,
          nextCalibrationDue: dateOnlyToDate(nextDueIso),
          calibrationStatus: computeCalibrationStatus(nextDueIso),
          damageStatus: data.damageStatus,
          damageType: data.damageType ?? null,
          assetNotes: data.assetNotes ?? null,
          repairNotes: data.repairNotes ?? null,
          estimatedRepairCost: data.estimatedRepairCost,
          cost: data.cost,
          replacementCost: data.replacementCost,
          acquiredDate: dateOnlyToDate(data.acquiredDate),
        },
      });

      await auditFromRequest(req, {
        action: 'equipment.created',
        entityType: 'equipment',
        entityId: created.id,
        siteId: created.siteId,
        field: 'assetNumber',
        newValue: created.assetNumber,
      });

      return res.status(201).json({ id: created.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ message: 'An asset with that number already exists' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

assetRoutes.put('/assets/:id', authorize('super_admin', 'site_supervisor'), async (req, res, next) => {
  try {
    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
    }
    const data = parsed.data;

    const existing = await prisma.equipment.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    if (req.user!.role === 'site_supervisor' && existing.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Field users can only update assets at their site' });
    }

    const resolved = await resolveSiteForWrite(req, data.siteId ?? null);
    if ('error' in resolved) {
      return res.status(req.user!.role === 'site_supervisor' ? 403 : 400).json({ message: resolved.error });
    }

    const nextDueIso = computeNextCalibrationDue(
      data.lastCalibrationDate ?? null,
      data.calibrationIntervalDays,
    );

    await prisma.equipment.update({
      where: { id: existing.id },
      data: {
        siteId: resolved.siteId,
        assetNumber: data.assetNumber,
        partNumber: data.partNumber ?? null,
        serialNumber: data.serialNumber ?? null,
        itemName: data.itemName,
        manufacturer: data.manufacturer ?? null,
        equipmentType: data.equipmentType,
        ownership: data.ownership,
        vendor: data.vendor ?? null,
        firmwareVersion: data.firmwareVersion ?? null,
        latestFirmwareVersion: data.latestFirmwareVersion ?? null,
        subscriptionEndDate: dateOnlyToDate(data.subscriptionEndDate),
        lastCalibrationDate: dateOnlyToDate(data.lastCalibrationDate),
        calibrationIntervalDays: data.calibrationIntervalDays,
        nextCalibrationDue: dateOnlyToDate(nextDueIso),
        calibrationStatus: computeCalibrationStatus(nextDueIso),
        damageStatus: data.damageStatus,
        damageType: data.damageType ?? null,
        assetNotes: data.assetNotes ?? null,
        repairNotes: data.repairNotes ?? null,
        estimatedRepairCost: data.estimatedRepairCost,
        cost: data.cost,
        replacementCost: data.replacementCost,
        acquiredDate: dateOnlyToDate(data.acquiredDate),
      },
    });

    await auditFromRequest(req, {
      action: 'equipment.updated',
      entityType: 'equipment',
      entityId: existing.id,
      siteId: resolved.siteId,
      field: 'assetNumber',
      oldValue: existing.assetNumber,
      newValue: data.assetNumber,
    });

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Dispose of equipment — sold / lost / stolen / written-off. We keep the record
// (never destroyed); it just leaves the active list.
assetRoutes.delete('/assets/:id', authorize('super_admin'), async (req, res, next) => {
  try {
    const parsed = disposeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid disposition', issues: parsed.error.issues });
    }

    const existing = await prisma.equipment.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    await prisma.equipment.update({
      where: { id: existing.id },
      data: { status: parsed.data.status, dispositionNotes: parsed.data.notes ?? null },
    });

    await auditFromRequest(req, {
      action: 'equipment.disposed',
      entityType: 'equipment',
      entityId: existing.id,
      siteId: existing.siteId,
      field: 'status',
      oldValue: existing.status,
      newValue: parsed.data.status,
    });

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Log a calibration event (on-site Survey Superintendent, with optional photo).
// Updates the equipment's last-calibrated date and recomputes its status.
assetRoutes.post(
  '/assets/:id/calibrations',
  authorize('super_admin', 'regional_director', 'site_supervisor'),
  async (req, res, next) => {
    try {
      const parsed = calibrationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
      }

      const equipment = await prisma.equipment.findFirst({
        where: { id: req.params.id, organizationId: req.user!.organizationId },
      });
      if (!equipment) {
        return res.status(404).json({ message: 'Asset not found' });
      }
      if (req.user!.role === 'site_supervisor' && equipment.siteId !== req.user!.siteId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const nextDueIso = computeNextCalibrationDue(
        parsed.data.calibratedDate,
        equipment.calibrationIntervalDays,
      );

      const record = await prisma.calibrationRecord.create({
        data: {
          organizationId: req.user!.organizationId,
          equipmentId: equipment.id,
          calibratedDate: dateOnlyToDate(parsed.data.calibratedDate)!,
          calibratedById: req.user!.id,
          photoUrl: parsed.data.photoUrl ?? null,
          notes: parsed.data.notes ?? null,
        },
      });

      await prisma.equipment.update({
        where: { id: equipment.id },
        data: {
          lastCalibrationDate: dateOnlyToDate(parsed.data.calibratedDate),
          nextCalibrationDue: dateOnlyToDate(nextDueIso),
          calibrationStatus: computeCalibrationStatus(nextDueIso),
        },
      });

      await auditFromRequest(req, {
        action: 'calibration.logged',
        entityType: 'equipment',
        entityId: equipment.id,
        siteId: equipment.siteId,
        field: 'lastCalibrationDate',
        oldValue: equipment.lastCalibrationDate ? toDateOnly(equipment.lastCalibrationDate) : null,
        newValue: parsed.data.calibratedDate,
      });

      return res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  },
);

// Calibration history for one piece of equipment.
assetRoutes.get('/assets/:id/calibrations', async (req, res, next) => {
  try {
    const equipment = await prisma.equipment.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      select: { id: true, siteId: true },
    });
    if (!equipment) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    if (req.user!.role === 'site_supervisor' && equipment.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const records = await prisma.calibrationRecord.findMany({
      where: { equipmentId: equipment.id, organizationId: req.user!.organizationId },
      include: { calibratedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { calibratedDate: 'desc' },
    });
    return res.json(records);
  } catch (err) {
    next(err);
  }
});

assetRoutes.post('/scan/asset', authorize('super_admin', 'site_supervisor'), async (req, res, next) => {
  try {
    const parsed = scanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const row = await prisma.equipment.findFirst({
      where: { assetNumber: parsed.data.assetNumber, organizationId: req.user!.organizationId },
      include: { site: true },
    });
    if (!row) {
      return res.status(404).json({ message: 'Asset not found' });
    }
    if (req.user!.role === 'site_supervisor' && row.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return res.json(toDto(row));
  } catch (err) {
    next(err);
  }
});
