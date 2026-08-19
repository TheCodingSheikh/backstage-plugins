import {
  AuthorizeResult,
  PolicyDecision,
} from '@backstage/plugin-permission-common';
import {
  PermissionPolicy,
  PolicyQuery,
  PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY } from '@thecodingsheikh/backstage-plugin-entity-scaffolder-common';

const RBAC_ANNOTATION = 'backstage.io/rbac';
const SCAFFOLDER_EDIT_ROLES_ANNOTATION = 'backstage.io/scaffolder-edit-roles';

/**
 * Permission policy wiring the app-level RBAC rules:
 *
 * - `catalog.entity.update` → DENY for everyone.
 * - `catalog.entity.delete` → DENY for everyone.
 * - `catalog.entity.read`:
 *     • entity has `backstage.io/rbac` annotation → only owners may read
 *     • otherwise → anyone may read
 * - `entity-scaffolder.edit`:
 *     • entity has `backstage.io/scaffolder-edit-roles` annotation → only
 *       owners whose `spec.owners.role` is in that CSV may use the embedded
 *       scaffolder workflow
 *     • otherwise → any signed-in user may use the workflow
 * - anything else → ALLOW
 *
 * The conditional catalog rules used here are registered by:
 *   - `@backstage/plugin-catalog-backend` (HAS_ANNOTATION, IS_ENTITY_OWNER)
 *   - `@thecodingsheikh/backstage-plugin-catalog-backend-module-entity-scaffolder`
 *     (the `entity-scaffolder-entity` resource type, plus HAS_ANNOTATION and
 *     IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE re-bound to it)
 */
export class ScaffolderRbacPolicy implements PermissionPolicy {
  async handle(
    request: PolicyQuery,
    user?: PolicyQueryUser,
  ): Promise<PolicyDecision> {
    const claims = user?.info.ownershipEntityRefs ?? [];

    if (
      request.permission.name === 'catalog.entity.update' ||
      request.permission.name === 'catalog.entity.delete'
    ) {
      return { result: AuthorizeResult.DENY };
    }

    if (request.permission.name === 'catalog.entity.read') {
      return {
        result: AuthorizeResult.CONDITIONAL,
        pluginId: 'catalog',
        resourceType: 'catalog-entity',
        conditions: {
          anyOf: [
            {
              not: {
                resourceType: 'catalog-entity',
                rule: 'HAS_ANNOTATION',
                params: { annotation: RBAC_ANNOTATION },
              },
            },
            {
              resourceType: 'catalog-entity',
              rule: 'IS_ENTITY_OWNER',
              params: { claims },
            },
          ],
        },
      };
    }

    if (request.permission.name === 'entity-scaffolder.edit') {
      return {
        result: AuthorizeResult.CONDITIONAL,
        pluginId: 'catalog',
        resourceType: RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
        conditions: {
          anyOf: [
            {
              not: {
                resourceType: RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
                rule: 'HAS_ANNOTATION',
                params: { annotation: SCAFFOLDER_EDIT_ROLES_ANNOTATION },
              },
            },
            {
              resourceType: RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
              rule: 'IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE',
              params: { claims, annotation: SCAFFOLDER_EDIT_ROLES_ANNOTATION },
            },
          ],
        },
      };
    }

    return { result: AuthorizeResult.ALLOW };
  }
}
