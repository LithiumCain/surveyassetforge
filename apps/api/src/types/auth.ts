export type UserRole = 'super_admin' | 'regional_director' | 'site_supervisor';

// The authenticated user, resolved once per request and attached to req.user.
// `organizationId` is the tenant boundary — every query is scoped by it.
export type AuthUser = {
  id: string;
  organizationId: string;
  role: UserRole;
  siteId: string | null;
};
