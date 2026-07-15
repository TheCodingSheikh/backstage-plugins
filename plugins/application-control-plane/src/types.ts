export type Role = 'view' | 'edit' | 'admin';
export type ResourceSummary = { name: string; kind: string; health: string; sync: string };
export type ApplicationSummary = {
  ref: string;
  tenant: string;
  name: string;
  title: string;
  description: string;
  namespace: string;
  effectiveRole: Role;
  health: string;
  sync: string;
  owners: Array<{ subject: string; role: Role }>;
  resources?: ResourceSummary[];
};
export type ActivityItem = { type: string; title: string; time?: string; actor: string; url: string };

export const canEdit = (role: Role) => role === 'edit' || role === 'admin';
export const canAdmin = (role: Role) => role === 'admin';
