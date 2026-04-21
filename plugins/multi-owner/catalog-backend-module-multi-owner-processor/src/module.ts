import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { MultiOwnerEntitiesProcessor } from './MultiOwnerEntitiesProcessor';
import {
  isEntityMultiOwnerWithAnnotationRole,
  isEntityMultiOwnerWithRole,
} from './permissions';

/**
 * Backend module that registers the {@link MultiOwnerEntitiesProcessor}
 * with the catalog processing pipeline and contributes permission rules
 * for role-aware owner checks on multi-owner entities.
 *
 * @remarks
 * Install this module in your backend by adding:
 * ```ts
 * backend.add(import('@thecodingsheikh/backstage-plugin-catalog-backend-module-multi-owner-processor'));
 * ```
 */
export default createBackendModule({
  pluginId: 'catalog',
  moduleId: 'multi-owner-processor',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        permissions: coreServices.permissionsRegistry,
        logger: coreServices.logger,
      },
      async init({ catalog, permissions, logger }) {
        catalog.addProcessor(new MultiOwnerEntitiesProcessor(logger));
        permissions.addPermissionRules([
          isEntityMultiOwnerWithRole,
          isEntityMultiOwnerWithAnnotationRole,
        ]);
      },
    });
  },
});
