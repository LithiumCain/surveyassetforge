export type UserRole = 'super_admin' | 'regional_director' | 'site_supervisor';

export type JwtPayload = {
  sub: string;
  role: UserRole;
  siteId: string | null;
  username: string;
};

export type AuthUser = {
  id: string;
  role: UserRole;
  siteId: string | null;
  username: string;
};
