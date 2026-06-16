import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditFromRequest } from '../services/audit.js';

const assignSchema = z.object({
  assignedToName: z.string().min(1).max(120),
  assignedToNumber: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const assignmentRoutes = Router();

assignmentRoutes.use(authenticate);

// ── Check out a piece of equipment to a person ───────────────────
assignmentRoutes.post(
  '/assets/:assetId/assign',
  authorize('super_admin', 'regional_director', 'site_supervisor'),
  async (req, res, next) => {
    try {
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
      }

      const equipment = await prisma.equipment.findFirst({
        where: { id: req.params.assetId, organizationId: req.user!.organizationId },
        select: { id: true, siteId: true, assetNumber: true },
      });
      if (!equipment) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      if (req.user!.role === 'site_supervisor' && req.user!.siteId !== equipment.siteId) {
        return res.status(403).json({ message: 'Cannot assign assets outside your site' });
      }

      const active = await prisma.assetAssignment.findFirst({
        where: {
          organizationId: req.user!.organizationId,
          equipmentId: equipment.id,
          checkedInAt: null,
        },
      });
      if (active) {
        return res.status(409).json({ message: 'Asset already checked out. Check it in before reassigning.' });
      }

      const assignment = await prisma.assetAssignment.create({
        data: {
          organizationId: req.user!.organizationId,
          equipmentId: equipment.id,
          siteId: equipment.siteId,
          assignedToName: parsed.data.assignedToName,
          assignedToNumber: parsed.data.assignedToNumber ?? null,
          notes: parsed.data.notes ?? null,
          assignedById: req.user!.id,
        },
      });

      await auditFromRequest(req, {
        action: 'assignment.created',
        entityType: 'assignment',
        entityId: assignment.id,
        siteId: equipment.siteId,
        field: equipment.assetNumber,
        newValue: parsed.data.assignedToName,
      });

      return res.status(201).json(assignment);
    } catch (err) {
      next(err);
    }
  },
);

// ── Check a piece of equipment back in ───────────────────────────
assignmentRoutes.post(
  '/assets/:assetId/checkin',
  authorize('super_admin', 'regional_director', 'site_supervisor'),
  async (req, res, next) => {
    try {
      const active = await prisma.assetAssignment.findFirst({
        where: {
          organizationId: req.user!.organizationId,
          equipmentId: req.params.assetId,
          checkedInAt: null,
        },
      });
      if (!active) {
        return res.status(404).json({ message: 'No active assignment found for this asset' });
      }

      if (req.user!.role === 'site_supervisor' && req.user!.siteId !== active.siteId) {
        return res.status(403).json({ message: 'Cannot check in assets outside your site' });
      }

      const updated = await prisma.assetAssignment.update({
        where: { id: active.id },
        data: { checkedInAt: new Date() },
      });

      await auditFromRequest(req, {
        action: 'assignment.checked_in',
        entityType: 'assignment',
        entityId: active.id,
        siteId: active.siteId,
        oldValue: active.assignedToName,
      });

      return res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── Custody history for one piece of equipment ───────────────────
assignmentRoutes.get('/assets/:assetId/assignments', async (req, res, next) => {
  try {
    const assignments = await prisma.assetAssignment.findMany({
      where: { organizationId: req.user!.organizationId, equipmentId: req.params.assetId },
      include: {
        assignedBy: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { checkedOutAt: 'desc' },
    });
    return res.json(assignments);
  } catch (err) {
    next(err);
  }
});

// ── All currently active assignments (manager view) ──────────────
assignmentRoutes.get(
  '/assignments/active',
  authorize('super_admin', 'regional_director'),
  async (req, res, next) => {
    try {
      const assignments = await prisma.assetAssignment.findMany({
        where: { organizationId: req.user!.organizationId, checkedInAt: null },
        include: {
          assignedBy: { select: { firstName: true, lastName: true, email: true } },
          equipment: { select: { assetNumber: true, itemName: true } },
          site: { select: { code: true, name: true } },
        },
        orderBy: { checkedOutAt: 'desc' },
      });
      return res.json(assignments);
    } catch (err) {
      next(err);
    }
  },
);
