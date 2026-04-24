import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../app.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const createSiteSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(12),
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

siteRoutes.post('/sites', authenticate, authorize('super_admin'), async (req, res, next) => {
  try {
    const parsed = createSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body' });
    }

    const { name, code } = parsed.data;
    const site = await prisma.site.create({
      data: {
        name,
        code: code.toUpperCase(),
      },
    });

    return res.status(201).json(site);
  } catch (err) {
    next(err);
  }
});
