import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { entityScaffolderEditPermission } from '@thecodingsheikh/backstage-plugin-entity-scaffolder-common';
import {
  entityScaffolderPermissionResourceRef,
  entityScaffolderPermissionRules,
} from './permissions';

/**
 * Catalog backend module that makes `entity-scaffolder.edit` addressable by
 * the permission framework.
 *
 * @remarks
 * It registers the `entity-scaffolder-entity` resource type on the catalog
 * plugin together with:
 *
 * - the `entity-scaffolder.edit` permission, so the permission shows up in the
 *   catalog's `/.well-known/backstage/permissions/metadata` response and can be
 *   selected by a conditional policy;
 * - the rules usable in that policy's `conditions` block;
 * - a `getResources` implementation that loads the catalog entities the
 *   conditions are evaluated against.
 *
 * Without this module the frontend's `usePermission` check still runs, but no
 * conditional policy can be bound to `entity-scaffolder.edit` — the only lever
 * left is an unconditional allow/deny on the permission name.
 *
 * Install it in your backend with:
 * ```ts
 * backend.add(import('@thecodingsheikh/backstage-plugin-catalog-backend-module-entity-scaffolder'));
 * ```
 */
export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'entity-scaffolder-permissions',
  register(reg) {
    reg.registerInit({
      deps: {
        permissions: coreServices.permissionsRegistry,
        auth: coreServices.auth,
        catalog: catalogServiceRef,
      },
      async init({ permissions, auth, catalog }) {
        permissions.addResourceType({
          resourceRef: entityScaffolderPermissionResourceRef,
          permissions: [entityScaffolderEditPermission],
          rules: entityScaffolderPermissionRules,
          getResources: async resourceRefs => {
            const { items } = await catalog.getEntitiesByRefs(
              { entityRefs: resourceRefs },
              { credentials: await auth.getOwnServiceCredentials() },
            );
            return items;
          },
        });
      },
    });
  },
});
