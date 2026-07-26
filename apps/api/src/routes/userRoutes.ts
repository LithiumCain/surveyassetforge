import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditFromRequest } from '../services/audit.js';

// Team management: list the organization's users, change role / site / active
// state. Reads are open to org-wide roles; writes are super_admin only.

const updateUserSchema = z
  .object({
    role: z.enum(['super_admin', 'regional_director', 'site_supervisor']).optional(),
    siteId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  siteId: true,
  isActive: true,
  createdAt: true,
  site: { select: { id: true, code: true, name: true } },
} as const;

export const userRoutes = Router();

userRoutes.use(authenticate);

// Everyone on the team, active and deactivated, newest last.
userRoutes.get(
  '/users',
  authorize('super_admin', 'regional_director'),
  async (req, res, next) => {
    try {
      const users = await prisma.user.findMany({
        where: { organizationId: req.user!.organizationId },
        select: userSelect,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      });
      return res.json(users);
    } catch (err) {
      next(err);
    }
  },
);

userRoutes.patch('/users/:id', authorize('super_admin'), async (req, res, next) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request body', issues: parsed.error.issues });
    }
    const { role, siteId, isActive } = parsed.data;

    const target = await prisma.user.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
    });
    if (!target) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Lock-out guard: you cannot demote or deactivate yourself. (Another
    // super_admin has to do it — so an org always keeps at least one admin.)
    if (target.id === req.user!.id && (role !== undefined || isActive !== undefined)) {
      return res.status(400).json({ message: "You can't change your own role or deactivate yourself" });
    }

    // A site may only be assigned from the caller's own organization.
    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, organizationId: req.user!.organizationId },
      });
      if (!site) {
        return res.status(400).json({ message: 'Unknown site for this organization' });
      }
    }

    const nextRole = role ?? (target.role as 'super_admin' | 'regional_director' | 'site_supervisor');
    const data: { role?: typeof nextRole; siteId?: string | null; isActive?: boolean } = {};
    if (role !== undefined) data.role = role;
    // Org-wide roles never carry a site; supervisors keep/get the one provided.
    if (nextRole !== 'site_supervisor') {
      data.siteId = null;
    } else if (siteId !== undefined) {
      data.siteId = siteId;
    }
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data,
      select: userSelect,
    });

    const changes: [string, string | null, string | null][] = [];
    if (role !== undefined && role !== target.role) changes.push(['role', target.role, role]);
    if (data.siteId !== undefined && data.siteId !== target.siteId)
      changes.push(['siteId', target.siteId, data.siteId]);
    if (isActive !== undefined && isActive !== target.isActive)
      changes.push(['isActive', String(target.isActive), String(isActive)]);
    for (const [field, oldValue, newValue] of changes) {
      await auditFromRequest(req, {
        action: 'user.updated',
        entityType: 'user',
        entityId: target.id,
        field,
        oldValue,
        newValue,
      });
    }

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});
