import { Entity } from '@backstage/catalog-model';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { canEditEntity, getAllowedEditRoles } from '../utils/canEditEntity';

/**
 * React hook that decides whether the current user may edit the given entity
 * via the entity-scaffolder tab.
 *
 * Reads `backstage.io/scaffolder-edit-roles` from the entity and intersects
 * the role allowlist with the current user's `spec.owners` role on the entity.
 *
 * Falls back to `allowed: true` when the annotation is absent.
 *
 * @example
 * ```tsx
 * const { entity } = useEntity();
 * const { allowed, loading } = useCanEditEntityScaffolder(entity);
 * if (!loading && allowed) {
 *   // render EntityScaffolderContent or the EntityLayout.Route
 * }
 * ```
 */
export function useCanEditEntityScaffolder(entity: Entity): {
  allowed: boolean;
  loading: boolean;
} {
  const identityApi = useApi(identityApiRef);
  const allowedRoles = getAllowedEditRoles(entity);

  const { value, loading } = useAsync(
    () => identityApi.getBackstageIdentity(),
    [identityApi],
  );

  if (!allowedRoles) {
    return { allowed: true, loading: false };
  }

  if (loading) {
    return { allowed: false, loading: true };
  }

  const refs = value?.ownershipEntityRefs ?? [];
  return { allowed: canEditEntity(entity, refs), loading: false };
}
