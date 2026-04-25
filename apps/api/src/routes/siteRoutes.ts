import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const createSiteSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(12),
  city: z.string().max(100).optional().nullable(),
  state: z.string().length(2).toUpperCase().optional().nullable(),
});

export const siteRoutes = Router();

siteRoutes.get('/sites', authenticate, async (req, res, next) => {
  try {
    let sites;
    if (req.user!.role === 'super_admin' || req.user!.role === 'regional_director') {
      sites = await prisma.site.findMany({
        orderBy: { name: 'asc' },
      });
    } else if (req.user!.role === 'site_supervisor' && req.user!.siteId) {
      sites = await prisma.site.findMany({
        where: { id: req.user!.siteId },
      });
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(sites);
  } catch (err) {
    next(err);
  }
});

siteRoutes.post('/sites', authenticate, authorize('super_admin', 'regional_director'), async (req, res, next) => {
  try {
    const parsed = createSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
    }

    const { name, code, city, state } = parsed.data;
    const site = await prisma.site.create({
      data: {
        name,
        code: code.toUpperCase(),
        city: city ?? null,
        state: state ?? null,
      },
    });

    return res.status(201).json(site);
  } catch (err) {
    next(err);
  }
});

siteRoutes.get('/dashboard/regional', authenticate, authorize('super_admin', 'regional_director'), async (req, res, next) => {
  try {
    type AlertRow = {
      site_id: string;
      site_code: string;
      site_name: string;
      city: string | null;
      state: string | null;
      critical_count: string;
      overdue_count: string;
      due_now_count: string;
    };

    const siteResult = await query<AlertRow>(
      `SELECT
        s.id    AS site_id,
        s.code  AS site_code,
        s.name  AS site_name,
        s.city,
        s.state,
        COUNT(CASE WHEN a.next_calibration_due < NOW() - INTERVAL '90 days' THEN 1 END)::int                                                                   AS critical_count,
        COUNT(CASE WHEN a.next_calibration_due >= NOW() - INTERVAL '90 days' AND a.next_calibration_due < NOW() - INTERVAL '30 days' THEN 1 END)::int          AS overdue_count,
        COUNT(CASE WHEN a.next_calibration_due >= NOW() - INTERVAL '30 days' AND a.next_calibration_due <= NOW() + INTERVAL '30 days' THEN 1 END)::int          AS due_now_count
      FROM sites s
      LEFT JOIN assets a ON a.site_id = s.id
      GROUP BY s.id, s.code, s.name, s.city, s.state
      ORDER BY (COUNT(CASE WHEN a.next_calibration_due < NOW() - INTERVAL '90 days' THEN 1 END) + COUNT(CASE WHEN a.next_calibration_due >= NOW() - INTERVAL '90 days' AND a.next_calibration_due < NOW() THEN 1 END)) DESC, s.name ASC`,
      [],
    );

    const siteAlerts = siteResult.rows
      .map((row) => ({
        siteId: row.site_id,
        siteCode: row.site_code,
        siteName: row.site_name,
        city: row.city,
        state: row.state,
        criticalCount: Number(row.critical_count),
        overdueCount: Number(row.overdue_count),
        dueNowCount: Number(row.due_now_count),
        totalIssues: Number(row.critical_count) + Number(row.overdue_count) + Number(row.due_now_count),
      }))
      .filter((s) => s.totalIssues > 0);

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
});
