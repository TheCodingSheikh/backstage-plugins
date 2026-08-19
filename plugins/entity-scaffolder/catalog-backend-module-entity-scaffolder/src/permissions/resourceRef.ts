import { Entity } from '@backstage/catalog-model';
import { EntitiesSearchFilter } from '@backstage/plugin-catalog-node';
import { createPermissionResourceRef } from '@backstage/plugin-permission-node';
import { RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY } from '@thecodingsheikh/backstage-plugin-entity-scaffolder-common';

/**
 * Resource reference for the `entity-scaffolder-entity` permission resource
 * type.
 *
 * @remarks
 * The type is owned by the `catalog` plugin — a resource ref may only be
 * registered by the plugin named in its `pluginId`, and the entities it
 * resolves are catalog entities. Owning it from the catalog also means no
 * extra plugin id has to be added to RHDH's
 * `permission.rbac.pluginsWithPermission`.
 */
export const entityScaffolderPermissionResourceRef =
  createPermissionResourceRef<Entity, EntitiesSearchFilter>().with({
    pluginId: 'catalog',
    resourceType: RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
  });
