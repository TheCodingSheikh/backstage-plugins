import {
  DEFAULT_NAMESPACE,
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION } from '../annotations';

interface OwnerEntry {
  name: string;
  role?: string;
}

function parseSpecOwners(raw: unknown): OwnerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: OwnerEntry[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed) out.push({ name: trimmed });
      continue;
    }
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { name?: unknown }).name === 'string'
    ) {
      const rec = entry as { name: string; role?: unknown };
      const name = rec.name.trim();
      if (!name) continue;
      const role =
        typeof rec.role === 'string' && rec.role.trim() ? rec.role.trim() : undefined;
      out.push(role ? { name, role } : { name });
    }
  }
  return out;
}

function normalize(ref: string): string {
  try {
    return stringifyEntityRef(
      parseEntityRef(ref, {
        defaultKind: 'group',
        defaultNamespace: DEFAULT_NAMESPACE,
      }),
    ).toLowerCase();
  } catch {
    return ref.toLowerCase();
  }
}

/**
 * Parses the comma-separated edit-roles annotation into a list of role names.
 * Returns `undefined` when the annotation is absent — callers treat this as
 * "no RBAC configured" and fall back to allowing edit.
 */
export function getAllowedEditRoles(entity: Entity): string[] | undefined {
  const raw = entity.metadata.annotations?.[ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION];
  if (typeof raw !== 'string') return undefined;
  const roles = raw
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
  return roles.length > 0 ? roles : undefined;
}

/**
 * Pure function: can a user with the given `ownershipEntityRefs` edit this
 * entity via the scaffolder tab?
 *
 * Rules:
 * - If the entity has no `scaffolder-edit-roles` annotation → `true` (fallback).
 * - Otherwise, the user must appear in `spec.owners` with a role contained in
 *   the annotation's allowlist. Shorthand (role-less) owners are denied when
 *   the annotation is set.
 */
export function canEditEntity(
  entity: Entity,
  ownershipEntityRefs: string[],
): boolean {
  const allowedRoles = getAllowedEditRoles(entity);
  if (!allowedRoles) return true;

  const owners = parseSpecOwners(
    (entity.spec as Record<string, unknown> | undefined)?.owners,
  );
  if (owners.length === 0) return false;

  const allowedRoleSet = new Set(allowedRoles);
  const userRefs = new Set(ownershipEntityRefs.map(normalize));

  return owners.some(
    o => o.role !== undefined && allowedRoleSet.has(o.role) && userRefs.has(normalize(o.name)),
  );
}
