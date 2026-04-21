import { LoggerService } from '@backstage/backend-plugin-api';
import pLimit from 'p-limit';
import { KubernetesProviderConfig } from '../lib/config';
import { KubernetesResourceFetcher } from '../services';

type WorkloadType = {
  group: string;
  apiVersion: string;
  plural: string;
  defaultType?: string;
  ingestAsResources?: boolean;
};

const DEFAULT_WORKLOAD_TYPES: WorkloadType[] = [
  { group: 'apps', apiVersion: 'v1', plural: 'deployments' },
  { group: 'apps', apiVersion: 'v1', plural: 'statefulsets' },
  { group: 'apps', apiVersion: 'v1', plural: 'daemonsets' },
  { group: 'batch', apiVersion: 'v1', plural: 'cronjobs' },
];

/**
 * Fetches standard workloads and configured custom-GVK workloads from
 * every allowed cluster, tagging each result with its cluster name.
 */
export class KubernetesDataProvider {
  constructor(
    private readonly resourceFetcher: KubernetesResourceFetcher,
    private readonly providerConfig: KubernetesProviderConfig,
    private readonly logger: LoggerService,
  ) {}

  private async resolveClusters(): Promise<string[]> {
    const allowed = this.providerConfig.allowedClusterNames;
    if (allowed && allowed.length > 0) return allowed;
    try {
      return await this.resourceFetcher.getClusters();
    } catch (error) {
      this.logger.error(
        `Failed to discover clusters: ${error instanceof Error ? error.message : error}`,
      );
      return [];
    }
  }

  async fetchKubernetesObjects(): Promise<any[]> {
    const clusters = await this.resolveClusters();
    if (clusters.length === 0) {
      this.logger.warn('No clusters available for ingestion.');
      return [];
    }

    const { components, annotationPrefix } = this.providerConfig;
    const workloadTypes: WorkloadType[] = [
      ...(components.disableDefaultWorkloadTypes ? [] : DEFAULT_WORKLOAD_TYPES),
      ...components.customWorkloadTypes.map(t => ({
        group: t.group,
        apiVersion: t.apiVersion,
        plural: t.plural,
        defaultType: t.defaultType,
        ingestAsResources: t.ingestAsResources,
      })),
    ];

    const excludedNamespaces = new Set(components.excludedNamespaces);
    const allObjects: any[] = [];
    const limit = pLimit(this.providerConfig.maxConcurrency);

    for (const clusterName of clusters) {
      const fetchedObjects = await Promise.allSettled(
        workloadTypes.map(type =>
          limit(async () => {
            try {
              const resources = await this.resourceFetcher.fetchResources({
                clusterName,
                resourcePath: `${type.group}/${type.apiVersion}/${type.plural}`,
              });
              return resources.map((resource: any) => ({
                ...resource,
                apiVersion: `${type.group}/${type.apiVersion}`,
                kind:
                  resource.kind ||
                  type.plural.charAt(0).toUpperCase() +
                    type.plural.slice(1, -1),
                ...(type.defaultType && { workloadType: type.defaultType }),
                ...(type.ingestAsResources !== undefined && {
                  ingestAsResources: type.ingestAsResources,
                }),
              }));
            } catch (error) {
              this.logger.debug(
                `Failed to fetch ${type.group}/${type.apiVersion}/${type.plural} from ${clusterName}: ${error}`,
              );
              return [];
            }
          }),
        ),
      );

      const all = fetchedObjects
        .filter(
          (r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled',
        )
        .flatMap(r => r.value);

      for (const resource of all) {
        if (!resource?.metadata) continue;
        if (resource.metadata.annotations?.[`${annotationPrefix}/exclude-from-catalog`]) {
          continue;
        }
        if (components.onlyIngestAnnotatedResources) {
          if (!resource.metadata.annotations?.[`${annotationPrefix}/add-to-catalog`]) {
            continue;
          }
        }
        if (excludedNamespaces.has(resource.metadata.namespace)) continue;

        allObjects.push({
          ...resource,
          clusterName,
          clusterEndpoint: clusterName,
        });
      }
    }

    return allObjects;
  }
}
