import {
  coreServices,
  createBackendModule,
  SchedulerServiceTaskScheduleDefinition,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { DEFAULT_SCHEDULE, readProviderConfigs } from './lib/config';
import {
  CrdApiEntityProvider,
  KubernetesEntityProvider,
} from './providers';
import { DefaultKubernetesResourceFetcher } from './services';

/**
 * Catalog module that ingests Kubernetes workloads, custom GVKs and
 * CRDs-as-APIs as catalog entities.
 *
 * Configuration lives under `catalog.providers.kubernetes.<id>`. Cluster
 * discovery and authentication are handled by the core kubernetes plugin
 * (`kubernetes.clusterLocatorMethods`).
 */
export const catalogModuleKubernetes = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'kubernetes',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        scheduler: coreServices.scheduler,
        auth: coreServices.auth,
        urlReader: coreServices.urlReader,
      },
      async init({
        catalog,
        logger,
        config,
        discovery,
        scheduler,
        auth,
        urlReader,
      }) {
        const providerConfigs = readProviderConfigs(config);
        if (providerConfigs.length === 0) {
          logger.info(
            'No kubernetes catalog providers configured under catalog.providers.kubernetes',
          );
          return;
        }

        const resourceFetcher = new DefaultKubernetesResourceFetcher(
          discovery,
          auth,
          logger,
        );

        for (const providerConfig of providerConfigs) {
          const schedule: SchedulerServiceTaskScheduleDefinition =
            providerConfig.schedule ?? DEFAULT_SCHEDULE;
          const taskRunner = scheduler.createScheduledTaskRunner(schedule);

          const entityProvider = new KubernetesEntityProvider(
            providerConfig,
            taskRunner,
            logger.child({
              target: 'kubernetes-entity-provider',
              provider: providerConfig.id,
            }),
            resourceFetcher,
            urlReader,
          );
          await catalog.addEntityProvider(entityProvider);

          if (providerConfig.crds.enabled) {
            const crdTaskRunner = scheduler.createScheduledTaskRunner(schedule);
            const crdProvider = new CrdApiEntityProvider(
              providerConfig,
              crdTaskRunner,
              logger.child({
                target: 'kubernetes-crd-api-provider',
                provider: providerConfig.id,
              }),
              resourceFetcher,
            );
            await catalog.addEntityProvider(crdProvider);
          }

          logger.info(
            `Registered kubernetes catalog provider "${providerConfig.id}"`,
          );
        }
      },
    });
  },
});
