import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  computeCalibrationStatus,
  computeCurrentValue,
  computeNextCalibrationDue,
  shouldRecommendReplacement,
} from '../services/calibration.js';
import { AssetRow } from '../types/asset.js';

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

const scanSchema = z.object({
  assetNumber: z.string().min(2),
});

const selectAssetSql = `
  SELECT
    a.id,
    a.asset_number,
    a.part_number,
    a.serial_number,
    a.item_name,
    a.manufacturer,
    a.equipment_type,
    a.site_id,
    s.name AS site_name,
    a.ownership,
    a.assigned_name,
    a.employee_number,
    a.vendor,
    a.firmware_version,
    a.latest_firmware_version,
    a.subscription_end_date,
    a.last_calibration_date,
    a.calibration_interval_days,
    a.next_calibration_due,
    a.calibration_status,
    a.damage_status,
    a.damage_type,
    a.asset_notes,
    a.repair_notes,
    a.estimated_repair_cost,
    a.cost,
    a.replacement_cost,
    a.acquired_date,
    a.source_sheet_name,
    a.source_row_number,
    a.created_at,
    a.updated_at
  FROM assets a
  JOIN sites s ON s.id = a.site_id
`;

const toDateOnly = (value: string | Date | null): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
};

const toDto = (row: AssetRow) => {
  const cost = Number(row.cost);
  const replacementCost = Number(row.replacement_cost);
  const estimatedRepairCost = Number(row.estimated_repair_cost);
  const acquiredDate = toDateOnly(row.acquired_date);
  const lastCalibrationDate = toDateOnly(row.last_calibration_date);
  const nextCalibrationDue = toDateOnly(row.next_calibration_due);
  const currentValue = computeCurrentValue(cost, acquiredDate);

  return {
    id: row.id,
    assetId: row.id,
    assetNumber: row.asset_number,
    partNumber: row.part_number,
    serialNumber: row.serial_number,
    itemName: row.item_name,
    manufacturer: row.manufacturer,
    equipmentType: row.equipment_type,
    siteId: row.site_id,
    siteName: row.site_name,
    ownership: row.ownership,
    assignedName: row.assigned_name,
    employeeNumber: row.employee_number,
    vendor: row.vendor,
    firmwareVersion: row.firmware_version,
    latestFirmwareVersion: row.latest_firmware_version,
    firmwareOutdated:
      !!row.latest_firmware_version && row.latest_firmware_version !== row.firmware_version,
    subscriptionEndDate: toDateOnly(row.subscription_end_date),
    lastCalibrationDate,
    calibrationIntervalDays: row.calibration_interval_days,
    nextCalibrationDue,
    calibrationStatus: row.calibration_status,
    damageStatus: row.damage_status,
    damageType: row.damage_type,
    assetNotes: row.asset_notes,
    repairNotes: row.repair_notes,
    estimatedRepairCost,
    cost,
    replacementCost,
    currentValue,
    replacementRecommended: shouldRecommendReplacement(estimatedRepairCost, replacementCost),
    acquiredDate,
    sourceSheetName: row.source_sheet_name,
    sourceRowNumber: row.source_row_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const assetRoutes = Router();

assetRoutes.use(authenticate);

assetRoutes.get('/assets', async (req, res, next) => {
  try {
    const params: unknown[] = [];
    let where = '';

    if (req.user!.role !== 'super_admin' && req.user!.role !== 'regional_director') {
      params.push(req.user!.siteId);
      where = ` WHERE a.site_id = $${params.length}`;
    }

    const result = await query<AssetRow>(`${selectAssetSql}${where} ORDER BY a.asset_number ASC`, params);
    res.json(result.rows.map(toDto));
  } catch (err) {
    next(err);
  }
});

assetRoutes.get('/assets/:id', async (req, res, next) => {
  try {
    const result = await query<AssetRow>(`${selectAssetSql} WHERE a.id = $1 LIMIT 1`, [req.params.id]);
    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (req.user!.role !== 'super_admin' && row.site_id !== req.user!.siteId) {
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

    const nextCalibrationDue = computeNextCalibrationDue(
      data.lastCalibrationDate ?? null,
      data.calibrationIntervalDays,
    );
    const calibrationStatus = computeCalibrationStatus(nextCalibrationDue);

    const result = await query<{ id: string }>(
      `INSERT INTO assets (
        asset_number, part_number, serial_number, item_name, manufacturer, equipment_type, site_id, ownership,
        assigned_name, employee_number, vendor, firmware_version, latest_firmware_version, subscription_end_date,
        last_calibration_date, calibration_interval_days, next_calibration_due, calibration_status,
        damage_status, damage_type, asset_notes, repair_notes, estimated_repair_cost, cost, replacement_cost,
        acquired_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25,
        $26
      ) RETURNING id`,
      [
        data.assetNumber,
        data.partNumber ?? null,
        data.serialNumber ?? null,
        data.itemName,
        data.manufacturer ?? null,
        data.equipmentType,
        data.siteId,
        data.ownership,
        data.assignedName ?? null,
        data.employeeNumber ?? null,
        data.vendor ?? null,
        data.firmwareVersion ?? null,
        data.latestFirmwareVersion ?? null,
        data.subscriptionEndDate ?? null,
        data.lastCalibrationDate ?? null,
        data.calibrationIntervalDays,
        nextCalibrationDue,
        calibrationStatus,
        data.damageStatus,
        data.damageType ?? null,
        data.assetNotes ?? null,
        data.repairNotes ?? null,
        data.estimatedRepairCost,
        data.cost,
        data.replacementCost,
        data.acquiredDate ?? null,
      ],
    );

    return res.status(201).json({ id: result.rows[0].id });
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

    const existing = await query<AssetRow>(`${selectAssetSql} WHERE a.id = $1 LIMIT 1`, [req.params.id]);
    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    const data = parsed.data;
    if (req.user!.role === 'site_supervisor' && row.site_id !== req.user!.siteId) {
      return res.status(403).json({ message: 'Field users can only update assets in their site' });
    }

    if (req.user!.role === 'site_supervisor' && data.siteId !== req.user!.siteId) {
      return res.status(403).json({ message: 'Field users cannot move assets to another site' });
    }

    const nextCalibrationDue = computeNextCalibrationDue(
      data.lastCalibrationDate ?? null,
      data.calibrationIntervalDays,
    );
    const calibrationStatus = computeCalibrationStatus(nextCalibrationDue);

    await query(
      `UPDATE assets SET
        asset_number = $1,
        part_number = $2,
        serial_number = $3,
        item_name = $4,
        manufacturer = $5,
        equipment_type = $6,
        site_id = $7,
        ownership = $8,
        assigned_name = $9,
        employee_number = $10,
        vendor = $11,
        firmware_version = $12,
        latest_firmware_version = $13,
        subscription_end_date = $14,
        last_calibration_date = $15,
        calibration_interval_days = $16,
        next_calibration_due = $17,
        calibration_status = $18,
        damage_status = $19,
        damage_type = $20,
        asset_notes = $21,
        repair_notes = $22,
        estimated_repair_cost = $23,
        cost = $24,
        replacement_cost = $25,
        acquired_date = $26,
        updated_at = NOW()
      WHERE id = $27`,
      [
        data.assetNumber,
        data.partNumber ?? null,
        data.serialNumber ?? null,
        data.itemName,
        data.manufacturer ?? null,
        data.equipmentType,
        data.siteId,
        data.ownership,
        data.assignedName ?? null,
        data.employeeNumber ?? null,
        data.vendor ?? null,
        data.firmwareVersion ?? null,
        data.latestFirmwareVersion ?? null,
        data.subscriptionEndDate ?? null,
        data.lastCalibrationDate ?? null,
        data.calibrationIntervalDays,
        nextCalibrationDue,
        calibrationStatus,
        data.damageStatus,
        data.damageType ?? null,
        data.assetNotes ?? null,
        data.repairNotes ?? null,
        data.estimatedRepairCost,
        data.cost,
        data.replacementCost,
        data.acquiredDate ?? null,
        req.params.id,
      ],
    );

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

assetRoutes.delete('/assets/:id', authorize('super_admin'), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM assets WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }
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

    const result = await query<AssetRow>(
      `${selectAssetSql} WHERE a.asset_number = $1 LIMIT 1`,
      [parsed.data.assetNumber],
    );

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    if (req.user!.role !== 'super_admin' && row.site_id !== req.user!.siteId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json(toDto(row));
  } catch (err) {
    next(err);
  }
});
