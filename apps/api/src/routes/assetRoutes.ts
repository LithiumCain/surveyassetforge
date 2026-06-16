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
  siteId: z.string().uuid(),
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
    siteName: e.site.name,
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
    acquiredDate,
    sourceSheetName: e.sourceSheetName,
    sourceRowNumber: e.sourceRowNumber,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
};

// Base org-scope for the caller. Supervisors are further limited to their site.
const listScope = (req: Request): Prisma.EquipmentWhereInput => {
  const where: Prisma.EquipmentWhereInput = {
    organizationId: req.user!.organizationId,
    status: { not: 'archived' },
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

assetRoutes.post('/assets', authorize('super_admin', 'site_supervisor'), async (req, res, next) => {
  try {
    const parsed = assetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
    }
    const data = parsed.data;

    if (req.user!.role === 'site_supervisor' && data.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Field users can only create assets in their site' });
    }

    // The target site must belong to the caller's organization.
    const site = await prisma.site.findFirst({
      where: { id: data.siteId, organizationId: req.user!.organizationId },
    });
    if (!site) {
      return res.status(400).json({ message: 'Unknown site for this organization' });
    }

    const nextDueIso = computeNextCalibrationDue(
      data.lastCalibrationDate ?? null,
      data.calibrationIntervalDays,
    );

    try {
      const created = await prisma.equipment.create({
        data: {
          organizationId: req.user!.organizationId,
          siteId: data.siteId,
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
      return res.status(403).json({ message: 'Field users can only update assets in their site' });
    }
    if (req.user!.role === 'site_supervisor' && data.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Field users cannot move assets to another site' });
    }

    const nextDueIso = computeNextCalibrationDue(
      data.lastCalibrationDate ?? null,
      data.calibrationIntervalDays,
    );

    await prisma.equipment.update({
      where: { id: existing.id },
      data: {
        siteId: data.siteId,
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
      siteId: data.siteId,
      field: 'assetNumber',
      oldValue: existing.assetNumber,
      newValue: data.assetNumber,
    });

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Soft delete — archive instead of destroying the record.
assetRoutes.delete('/assets/:id', authorize('super_admin'), async (req, res, next) => {
  try {
    const existing = await prisma.equipment.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    await prisma.equipment.update({
      where: { id: existing.id },
      data: { status: 'archived' },
    });

    await auditFromRequest(req, {
      action: 'equipment.archived',
      entityType: 'equipment',
      entityId: existing.id,
      siteId: existing.siteId,
      field: 'status',
      oldValue: existing.status,
      newValue: 'archived',
    });

    return res.status(204).send();
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
