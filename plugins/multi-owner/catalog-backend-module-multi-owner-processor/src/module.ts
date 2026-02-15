import { createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { MultiOwnerEntitiesProcessor } from './MultiOwnerEntitiesProcessor';

/**
 * Backend module that registers the {@link MultiOwnerEntitiesProcessor}
 * with the catalog processing pipeline.
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
            },
            async init({ catalog }) {
                catalog.addProcessor(new MultiOwnerEntitiesProcessor());
            },
        });
    },
});
