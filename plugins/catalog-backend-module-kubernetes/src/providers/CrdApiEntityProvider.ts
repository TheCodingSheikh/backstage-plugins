import { LoggerService, SchedulerServiceTaskRunner } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import yaml from 'js-yaml';
import pLimit from 'p-limit';
import { KubernetesProviderConfig } from '../lib/config';
import { KubernetesResourceFetcher } from '../services';

/**
 * Generates API entities from CustomResourceDefinitions found in the
 * configured clusters. Emits one API entity per CRD version.
 *
 * - `crds.enabled` must be true for this provider to be registered.
 * - Use `crds` (exact names in `plural.group` form) or `crdLabelSelector`
 *   to filter which CRDs are ingested.
 * - `crds.ingestAPIsAsCRDs` controls whether the emitted API is of type
 *   `crd` (definition = raw CRD YAML) or `openapi` (definition = a
 *   generated OpenAPI spec).
 */
export class CrdApiEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  constructor(
    private readonly providerConfig: KubernetesProviderConfig,
    private readonly taskRunner: SchedulerServiceTaskRunner,
    private readonly logger: LoggerService,
    private readonly resourceFetcher: KubernetesResourceFetcher,
  ) {}

  getProviderName(): string {
    return `kubernetes-crd-api:${this.providerConfig.id}`;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => this.run(),
    });
  }

  private async resolveClusters(): Promise<string[]> {
    const allowed = this.providerConfig.allowedClusterNames;
    if (allowed && allowed.length > 0) return allowed;
    try {
      return await this.resourceFetcher.getClusters();
    } catch (error) {
      this.logger.error(`CRD provider: cluster discovery failed: ${error}`);
      return [];
    }
  }

  async run(): Promise<void> {
    if (!this.connection) throw new Error('Connection not initialized');
    if (!this.providerConfig.crds.enabled) {
      await this.connection.applyMutation({ type: 'full', entities: [] });
      return;
    }

    const crds = await this.fetchCrds();
    const entities = crds.flatMap(crd => this.translateCrd(crd));

    await this.connection.applyMutation({
      type: 'full',
      entities: entities.map(entity => ({
        entity,
        locationKey: `provider:${this.getProviderName()}`,
      })),
    });
  }

  private async fetchCrds(): Promise<any[]> {
    const clusters = await this.resolveClusters();
    if (clusters.length === 0) return [];

    const { crds: crdCfg } = this.providerConfig;
    const crdMap = new Map<string, any>();
    const limit = pLimit(this.providerConfig.maxConcurrency);

    await Promise.all(
      clusters.map(clusterName =>
        limit(async () => {
          try {
            const labelSelector = crdCfg.crdLabelSelector
              ? {
                  labelSelector: `${crdCfg.crdLabelSelector.key}=${crdCfg.crdLabelSelector.value}`,
                }
              : undefined;

            const fetched = await this.resourceFetcher.fetchResources<any>({
              clusterName,
              resourcePath: 'apiextensions.k8s.io/v1/customresourcedefinitions',
              query: labelSelector,
            });

            for (const crd of fetched) {
              if (
                crdCfg.crds.length > 0 &&
                !crdCfg.crds.includes(crd.metadata.name)
              ) {
                continue;
              }
              const crdKey = `${crd.spec.group}/${crd.spec.names.plural}`;
              const existing = crdMap.get(crdKey);
              if (existing) {
                if (!existing.clusters.includes(clusterName)) {
                  existing.clusters.push(clusterName);
                  existing.clusterDetails.push({
                    name: clusterName,
                    url: clusterName,
                  });
                }
              } else {
                crdMap.set(crdKey, {
                  ...crd,
                  clusterName,
                  clusterEndpoint: clusterName,
                  clusters: [clusterName],
                  clusterDetails: [{ name: clusterName, url: clusterName }],
                });
              }
            }
          } catch (error) {
            this.logger.error(
              `Failed to fetch CRDs for cluster ${clusterName}: ${error}`,
            );
          }
        }),
      ),
    );

    return Array.from(crdMap.values());
  }

  private translateCrd(crd: any): Entity[] {
    if (!crd?.metadata || !crd?.spec?.versions) return [];
    const { ingestAPIsAsCRDs, system } = this.providerConfig.crds;
    const { defaultOwner } = this.providerConfig;

    return crd.spec.versions
      .map((version: any) =>
        this.buildApiEntity(crd, version, ingestAPIsAsCRDs, defaultOwner, system),
      )
      .filter(
        (entity: Entity | undefined): entity is Entity =>
          !!entity && entity.metadata.name.length <= 63,
      );
  }

  private buildApiEntity(
    crd: any,
    version: any,
    ingestAsCrd: boolean,
    defaultOwner: string,
    system: string,
  ): Entity | undefined {
    const baseName = `${crd.spec.names.kind.toLowerCase()}-${crd.spec.group}--${version.name}`;
    const commonMetadata = {
      name: baseName,
      title: baseName,
      tags: ['crd'],
      annotations: {
        'backstage.io/managed-by-location': `cluster origin: ${crd.clusterName}`,
        'backstage.io/managed-by-origin-location': `cluster origin: ${crd.clusterName}`,
      },
    };

    if (ingestAsCrd) {
      const crdWithMetadata = {
        apiVersion: crd.apiVersion || 'apiextensions.k8s.io/v1',
        kind: crd.kind || 'CustomResourceDefinition',
        ...crd,
      };
      return {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: commonMetadata,
        spec: {
          type: 'crd',
          lifecycle: 'production',
          owner: defaultOwner,
          system,
          definition: yaml.dump(crdWithMetadata),
        },
      };
    }

    const openApiDoc = this.buildOpenApiDoc(crd, version);
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: commonMetadata,
      spec: {
        type: 'openapi',
        lifecycle: 'production',
        owner: defaultOwner,
        system: 'kubernetes-auto-ingested',
        definition: yaml.dump(openApiDoc),
      },
    };
  }

  private buildOpenApiDoc(crd: any, version: any): any {
    const pathsNamespaced = {
      [`/apis/${crd.spec.group}/${version.name}/namespaces/{namespace}/${crd.spec.names.plural}`]:
        {
          get: {
            tags: ['Namespace Scoped Operations'],
            summary: `List ${crd.spec.names.plural} in a namespace`,
            operationId: `list${crd.spec.names.plural}Namespaced`,
            parameters: [
              { name: 'namespace', in: 'path', required: true, schema: { type: 'string' } },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
    };
    const pathsCluster = {
      [`/apis/${crd.spec.group}/${version.name}/${crd.spec.names.plural}`]: {
        get: {
          tags: ['Cluster Scoped Operations'],
          summary: `List all ${crd.spec.names.plural}`,
          operationId: `list${crd.spec.names.plural}`,
          responses: { '200': { description: 'OK' } },
        },
      },
    };
    return {
      openapi: '3.0.0',
      info: {
        title: `${crd.spec.names.plural}.${crd.spec.group}`,
        version: version.name,
      },
      servers: crd.clusterDetails.map((c: any) => ({
        url: c.url,
        description: c.name,
      })),
      paths:
        crd.spec.scope === 'Cluster'
          ? pathsCluster
          : { ...pathsCluster, ...pathsNamespaced },
      components: {
        schemas: {
          Resource: {
            type: 'object',
            properties: version.schema?.openAPIV3Schema?.properties ?? {},
          },
        },
      },
    };
  }
}
