import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type AuditInput = {
  organizationId: string;
  userId?: string | null;
  siteId?: string | null;
  action: string; // e.g. 'equipment.created', 'equipment.updated'
  entityType: string; // 'equipment' | 'site' | 'assignment' | 'user'
  entityId: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
};

// Single helper so EVERY mutation records a consistent, org-scoped audit row.
export const recordAudit = async (input: AuditInput): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      siteId: input.siteId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      field: input.field ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
};

// Convenience wrapper: pulls actor + org + IP/user-agent straight off the
// request so routes only supply what changed.
export const auditFromRequest = async (
  req: Request,
  partial: Omit<AuditInput, 'organizationId' | 'userId' | 'ipAddress' | 'userAgent'> & {
    siteId?: string | null;
  },
): Promise<void> => {
  await recordAudit({
    organizationId: req.user!.organizationId,
    userId: req.user!.id,
    ipAddress: req.ip ?? null,
    userAgent: req.header('user-agent') ?? null,
    ...partial,
  });
};
