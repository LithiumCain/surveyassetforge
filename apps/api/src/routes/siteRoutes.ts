import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditFromRequest } from '../services/audit.js';

const createSiteSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(12),
  city: z.string().max(100).optional().nullable(),
  state: z.string().length(2).toUpperCase().optional().nullable(),
});

export const siteRoutes = Router();

// List sites within the caller's organization (supervisors see only their own).
siteRoutes.get('/sites', authenticate, async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId;

    if (req.user!.role === 'super_admin' || req.user!.role === 'regional_director') {
      const sites = await prisma.site.findMany({
        where: { organizationId: orgId },
        orderBy: { name: 'asc' },
      });
      return res.json(sites);
    }

    if (req.user!.role === 'site_supervisor' && req.user!.siteId) {
      const sites = await prisma.site.findMany({
        where: { organizationId: orgId, id: req.user!.siteId },
      });
      return res.json(sites);
    }

    return res.status(403).json({ message: 'Forbidden' });
  } catch (err) {
    next(err);
  }
});

siteRoutes.post(
  '/sites',
  authenticate,
  authorize('super_admin', 'regional_director'),
  async (req, res, next) => {
    try {
      const parsed = createSiteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
      }

      const { name, code, city, state } = parsed.data;
      const site = await prisma.site.create({
        data: {
          organizationId: req.user!.organizationId,
          name,
          code: code.toUpperCase(),
          city: city ?? null,
          state: state ?? null,
        },
      });

      await auditFromRequest(req, {
        action: 'site.created',
        entityType: 'site',
        entityId: site.id,
        siteId: site.id,
        newValue: site.code,
      });

      return res.status(201).json(site);
    } catch (err) {
      next(err);
    }
  },
);

// Regional dashboard — per-site calibration issue counts, org-scoped.
siteRoutes.get(
  '/dashboard/regional',
  authenticate,
  authorize('super_admin', 'regional_director'),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId;
      const today = Date.now();
      const ninetyDaysMs = 90 * 86_400_000;

      const sites = await prisma.site.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          equipment: {
            where: { status: 'active' },
            select: { calibrationStatus: true, nextCalibrationDue: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const siteAlerts = sites
        .map((s) => {
          let criticalCount = 0; // overdue by more than 90 days
          let overdueCount = 0; // overdue within 90 days
          let dueNowCount = 0; // due soon / warning window

          for (const e of s.equipment) {
            if (e.calibrationStatus === 'overdue') {
              const due = e.nextCalibrationDue ? e.nextCalibrationDue.getTime() : today;
              if (today - due > ninetyDaysMs) criticalCount += 1;
              else overdueCount += 1;
            } else if (e.calibrationStatus === 'due_soon' || e.calibrationStatus === 'warning') {
              dueNowCount += 1;
            }
          }

          return {
            siteId: s.id,
            siteCode: s.code,
            siteName: s.name,
            city: s.city,
            state: s.state,
            criticalCount,
            overdueCount,
            dueNowCount,
            totalIssues: criticalCount + overdueCount + dueNowCount,
          };
        })
        .filter((s) => s.totalIssues > 0)
        .sort((a, b) => b.totalIssues - a.totalIssues || a.siteName.localeCompare(b.siteName));

      const totals = siteAlerts.reduce(
        (acc, s) => {
          acc.critical += s.criticalCount;
          acc.overdue += s.overdueCount;
          acc.dueNow += s.dueNowCount;
          return acc;
        },
        { critical: 0, overdue: 0, dueNow: 0 },
      );

      return res.json({ alerts: totals, siteAlerts });
    } catch (err) {
      next(err);
    }
  },
);
