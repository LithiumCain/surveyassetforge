import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const assignSchema = z.object({
  assignedToName:   z.string().min(1).max(120),
  assignedToNumber: z.string().max(40).optional().nullable(),
  notes:            z.string().max(500).optional().nullable(),
});

export const assignmentRoutes = Router();

assignmentRoutes.use(authenticate);

// ── Check out an asset to a person ──────────────────────────────
assignmentRoutes.post(
  '/assets/:assetId/assign',
  authorize('super_admin', 'regional_director', 'site_supervisor'),
  async (req, res, next) => {
    try {
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
      }

      const assetResult = await query<{ site_id: string; asset_number: string }>(
        'SELECT site_id, asset_number FROM assets WHERE id = $1',
        [req.params.assetId],
      );
      if (!assetResult.rows[0]) {
        return res.status(404).json({ message: 'Asset not found' });
      }
      const { site_id: siteId, asset_number: assetNumber } = assetResult.rows[0];

      if (req.user!.role === 'site_supervisor' && req.user!.siteId !== siteId) {
        return res.status(403).json({ message: 'Cannot assign assets outside your site' });
      }

      const active = await prisma.assetAssignment.findFirst({
        where: { assetId: req.params.assetId, checkedInAt: null },
      });
      if (active) {
        return res.status(409).json({ message: 'Asset already checked out. Check it in before reassigning.' });
      }

      const assignment = await prisma.assetAssignment.create({
        data: {
          assetId:          req.params.assetId,
          assignedToName:   parsed.data.assignedToName,
          assignedToNumber: parsed.data.assignedToNumber ?? null,
          siteId,
          notes:            parsed.data.notes ?? null,
          assignedById:     req.user!.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId:   req.user!.id,
          siteId,
          action:   'ASSET_ASSIGNED',
          field:    assetNumber,
          newValue: parsed.data.assignedToName,
        },
      });

      return res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  },
);

// ── Check in an asset ────────────────────────────────────────────
assignmentRoutes.post(
  '/assets/:assetId/checkin',
  authorize('super_admin', 'regional_director', 'site_supervisor'),
  async (req, res, next) => {
    try {
      const active = await prisma.assetAssignment.findFirst({
        where: { assetId: req.params.assetId, checkedInAt: null },
      });
      if (!active) {
        return res.status(404).json({ message: 'No active assignment found for this asset' });
      }

      if (req.user!.role === 'site_supervisor' && req.user!.siteId !== active.siteId) {
        return res.status(403).json({ message: 'Cannot check in assets outside your site' });
      }

      const updated = await prisma.assetAssignment.update({
        where: { id: active.id },
        data:  { checkedInAt: new Date() },
      });

      const assetResult = await query<{ asset_number: string }>(
        'SELECT asset_number FROM assets WHERE id = $1',
        [req.params.assetId],
      );

      await prisma.auditLog.create({
        data: {
          userId:   req.user!.id,
          siteId:   active.siteId,
          action:   'ASSET_CHECKED_IN',
          field:    assetResult.rows[0]?.asset_number ?? req.params.assetId,
          oldValue: active.assignedToName,
        },
      });

      return res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── Custody history for one asset ────────────────────────────────
assignmentRoutes.get('/assets/:assetId/assignments', async (req, res, next) => {
  try {
    const assignments = await prisma.assetAssignment.findMany({
      where:   { assetId: req.params.assetId },
      include: {
        assignedBy: { select: { username: true, firstName: true, lastName: true } },
      },
      orderBy: { checkedOutAt: 'desc' },
    });
    return res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// ── All currently active assignments (manager view) ───────────────
assignmentRoutes.get(
  '/assignments/active',
  authorize('super_admin', 'regional_director'),
  async (req, res, next) => {
    try {
      const assignments = await prisma.assetAssignment.findMany({
        where:   { checkedInAt: null },
        include: {
          assignedBy: { select: { username: true } },
          site:       { select: { code: true, name: true } },
        },
        orderBy: { checkedOutAt: 'desc' },
      });
      return res.json(assignments);
    } catch (err) {
      next(err);
    }
  },
);
