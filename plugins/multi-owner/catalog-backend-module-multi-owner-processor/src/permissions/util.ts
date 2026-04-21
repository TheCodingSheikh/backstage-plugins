import {
  DEFAULT_NAMESPACE,
  Entity,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { parseOwners } from '@thecodingsheikh/backstage-plugin-multi-owner-common';

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
 * Shared apply-logic for the multi-owner permission rules.
 *
 * Returns `true` when `entity.spec.owners` contains at least one entry whose
 * `role` is in `allowedRoles` AND whose `name` (normalised as an entity ref)
 * is in `claims`.
 */
export function hasMultiOwnerWithRole(
  entity: Entity,
  claims: string[],
  allowedRoles: string[],
): boolean {
  if (allowedRoles.length === 0 || claims.length === 0) return false;

  const owners = parseOwners(
    (entity.spec as Record<string, unknown> | undefined)?.owners,
  );
  if (owners.length === 0) return false;

  const allowedRoleSet = new Set(allowedRoles);
  const claimSet = new Set(claims.map(normalize));

  return owners.some(
    o =>
      o.role !== undefined &&
      allowedRoleSet.has(o.role) &&
      claimSet.has(normalize(o.name)),
  );
}

/**
 * Parses a comma-separated annotation value into a trimmed, non-empty list
 * of role names. Returns `undefined` when the annotation is missing or empty.
 */
export function parseRolesAnnotation(
  entity: Entity,
  annotationName: string,
): string[] | undefined {
  const raw = entity.metadata.annotations?.[annotationName];
  if (typeof raw !== 'string') return undefined;
  const roles = raw
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
  return roles.length > 0 ? roles : undefined;
}
