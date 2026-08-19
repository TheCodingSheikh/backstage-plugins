import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Resource type used by {@link entityScaffolderEditPermission}.
 *
 * @remarks
 * This is deliberately a dedicated resource type rather than the catalog's
 * `catalog-entity`.
 *
 * Policy providers that store conditional policies — most notably the Red Hat
 * Developer Hub RBAC plugin — do not let you name a permission directly. They
 * select one by `(resourceType, action)` and bind the condition to the first
 * match. Sharing `catalog-entity` would therefore make `entity-scaffolder.edit`
 * indistinguishable from `catalog.entity.refresh`, which is also
 * `catalog-entity` + `update`, and no conditional policy could ever be scoped
 * to this permission.
 *
 * The resource behind this type is still an ordinary catalog `Entity`. The type
 * is registered — together with the rules and the entity lookup needed to
 * evaluate conditions — by
 * `@thecodingsheikh/backstage-plugin-catalog-backend-module-entity-scaffolder`.
 */
export const RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY =
  'entity-scaffolder-entity';

/**
 * Permission used to authorize editing an entity's configuration through the
 * embedded entity-scaffolder workflow.
 */
export const entityScaffolderEditPermission = createPermission({
  name: 'entity-scaffolder.edit',
  attributes: { action: 'update' },
  resourceType: RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
});

/**
 * List of all permissions exposed by the entity-scaffolder plugin.
 */
export const entityScaffolderPermissions = [entityScaffolderEditPermission];
