import type { Entity } from '@backstage/catalog-model';

export const PLATFORM_ADMINS = 'group:default/platform-admins';
export type ApplicationRole = 'view' | 'edit' | 'admin';
const rank: Record<ApplicationRole, number> = { view: 1, edit: 2, admin: 3 };

export type OwnerGrant = { subject: string; role: ApplicationRole };

function validRole(value: unknown): value is ApplicationRole {
  return value === 'view' || value === 'edit' || value === 'admin';
}
export function applicationOwners(entity: Entity): OwnerGrant[] {
  const raw = entity.spec?.owners;
  if (Array.isArray(raw)) {
    return raw.flatMap(item => {
      if (typeof item === 'string') return parseOwnerString(item);
      if (!item || typeof item !== 'object') return [];
      const owner = item as { subject?: unknown; name?: unknown; role?: unknown };
      const subject = owner.subject ?? owner.name;
      return typeof subject === 'string' && subject.startsWith('group:default/') && validRole(owner.role)
        ? [{ subject, role: owner.role }]
        : [];
    });
  }
  const annotation = entity.metadata.annotations?.['ncai.backstage.io/owners'] ?? '';
  return annotation.split(',').flatMap(parseOwnerString);
}

function parseOwnerString(raw: string): OwnerGrant[] {
  const match = raw.trim().match(/^(group:default\/[a-z0-9](?:[-a-z0-9]*[a-z0-9])?):(admin|edit|view)$/);
  return match ? [{ subject: match[1], role: match[2] as ApplicationRole }] : [];
}

export function effectiveRole(entity: Entity, ownershipRefs: string[]): ApplicationRole | undefined {
  if (ownershipRefs.includes(PLATFORM_ADMINS)) return 'admin';
  let result: ApplicationRole | undefined;
  for (const owner of applicationOwners(entity)) {
    if (ownershipRefs.includes(owner.subject) && (!result || rank[owner.role] > rank[result])) result = owner.role;
  }
  return result;
}

export function hasRole(actual: ApplicationRole | undefined, required: ApplicationRole): boolean {
  return actual !== undefined && rank[actual] >= rank[required];
}

export function isApplication(entity: Entity): boolean {
  return entity.kind.toLocaleLowerCase('en-US') === 'system' && entity.spec?.type === 'application';
}

export function applicationData(entity: Entity) {
  const annotations = entity.metadata.annotations ?? {};
  const tenant = annotations['ncai.backstage.io/tenant'];
  const name = annotations['ncai.backstage.io/title'] ?? entity.metadata.title ?? entity.metadata.name;
  if (!tenant || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(tenant) || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
    throw new Error(`Invalid managed application entity: ${entity.metadata.name}`);
  }
  return {
    ref: `system:${entity.metadata.namespace ?? 'default'}/${entity.metadata.name}`,
    tenant,
    name,
    title: `${name} (${tenant})`,
    description: entity.metadata.description ?? annotations['ncai.backstage.io/description'] ?? '',
    namespace: `${tenant}-tenant-${name}`,
    owners: applicationOwners(entity),
  };
}
