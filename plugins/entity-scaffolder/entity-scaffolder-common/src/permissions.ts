import { createPermission } from '@backstage/plugin-permission-common';
import { RESOURCE_TYPE_CATALOG_ENTITY } from '@backstage/plugin-catalog-common/alpha';

/**
 * Permission used to authorize editing an entity's configuration through the
 * embedded entity-scaffolder workflow.
 *
 * Declared as a resource permission against `catalog-entity` so that existing
 * catalog conditional rules (e.g. `IS_ENTITY_OWNER`, `HAS_ANNOTATION`) can be
 * used to author policies without any plugin-specific rule code.
 */
export const entityScaffolderEditPermission = createPermission({
  name: 'entity-scaffolder.edit',
  attributes: { action: 'update' },
  resourceType: RESOURCE_TYPE_CATALOG_ENTITY,
});

/**
 * List of all permissions exposed by the entity-scaffolder plugin.
 */
export const entityScaffolderPermissions = [entityScaffolderEditPermission];
