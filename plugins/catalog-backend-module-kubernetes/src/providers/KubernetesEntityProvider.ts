import {
  LoggerService,
  SchedulerServiceTaskRunner,
  UrlReaderService,
} from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import pLimit from 'p-limit';
import pluralize from 'pluralize';
import { KubernetesProviderConfig } from '../lib/config';
import { ApiDefinitionFetcher, KubernetesResourceFetcher } from '../services';
import { KubernetesDataProvider } from './KubernetesDataProvider';

interface BackstageLink {
  url: string;
  title: string;
  icon: string;
  [key: string]: string;
}

function splitAnnotationValues(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return value
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function resolveOwnerRef(
  ownerAnnotation: string | undefined,
  namespacePrefix: string,
  defaultOwner: string,
): string {
  if (!ownerAnnotation) return `${namespacePrefix}/${defaultOwner}`;
  if (ownerAnnotation.includes(':')) return ownerAnnotation;
  return `${namespacePrefix}/${ownerAnnotation}`;
}

/**
 * Catalog provider that ingests standard and custom-GVK Kubernetes
 * workloads as Component (or Resource) entities, plus a System entity
 * per namespace/cluster and optionally a linked API entity derived from
 * workload annotations.
 */
export class KubernetesEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly apiDefinitionFetcher: ApiDefinitionFetcher;
  private namespaceAnnotationsCache = new Map<
    string,
    Promise<Record<string, string> | null>
  >();

  constructor(
    private readonly providerConfig: KubernetesProviderConfig,
    private readonly taskRunner: SchedulerServiceTaskRunner,
    private readonly logger: LoggerService,
    private readonly resourceFetcher: KubernetesResourceFetcher,
    urlReader?: UrlReaderService,
  ) {
    this.apiDefinitionFetcher = new ApiDefinitionFetcher(
      resourceFetcher,
      providerConfig.annotationPrefix,
      logger,
      urlReader,
    );
  }

  getProviderName(): string {
    return `kubernetes:${this.providerConfig.id}`;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => this.run(),
    });
  }

  async run(): Promise<void> {
    if (!this.connection) throw new Error('Connection not initialized');
    try {
      this.namespaceAnnotationsCache.clear();

      if (!this.providerConfig.components.enabled) {
        await this.connection.applyMutation({ type: 'full', entities: [] });
        return;
      }

      const dataProvider = new KubernetesDataProvider(
        this.resourceFetcher,
        this.providerConfig,
        this.logger,
      );
      const objects = await dataProvider.fetchKubernetesObjects();

      const limit = pLimit(this.providerConfig.maxConcurrency);
      const translated = await Promise.all(
        objects.map(obj => limit(() => this.translateToEntities(obj))),
      );
      const entities = translated.flat();

      this.logger.info(
        `${this.getProviderName()}: emitting ${entities.length} entities ` +
          `from ${objects.length} workloads (concurrency ${this.providerConfig.maxConcurrency}). ` +
          `Entities absent from this snapshot will be removed by the catalog.`,
      );

      await this.connection.applyMutation({
        type: 'full',
        entities: entities.map(entity => ({
          entity,
          locationKey: `provider:${this.getProviderName()}`,
        })),
      });
    } catch (error) {
      this.logger.error(`Failed to run ${this.getProviderName()}: ${error}`);
    }
  }

  private validateEntityName(entity: Entity): boolean {
    if (entity.metadata.name.length > 63) {
      this.logger.warn(
        `Entity ${entity.metadata.name} (${entity.kind}) skipped: name exceeds 63 characters.`,
      );
      return false;
    }
    return true;
  }

  private mapClusterName(clusterName: string): string {
    const m = this.providerConfig.clusterNameMapping;
    if (!m) return clusterName;
    if (m.mode === 'prefix-replacement') {
      if (m.sourcePrefix && m.targetPrefix && clusterName.startsWith(m.sourcePrefix)) {
        return clusterName.replace(m.sourcePrefix, m.targetPrefix);
      }
    } else if (m.mode === 'explicit' && m.mappings?.[clusterName]) {
      return m.mappings[clusterName];
    }
    return clusterName;
  }

  private getNormalizedClusterName(clusterName: string): string {
    const m = this.providerConfig.clusterNameMapping;
    if (!m) return clusterName;
    if (m.mode === 'prefix-replacement') {
      if (m.sourcePrefix && clusterName.startsWith(m.sourcePrefix)) {
        return clusterName.substring(m.sourcePrefix.length);
      }
      if (m.targetPrefix && clusterName.startsWith(m.targetPrefix)) {
        return clusterName.substring(m.targetPrefix.length);
      }
    } else if (m.mode === 'explicit' && m.mappings) {
      const mappedValue = m.mappings[clusterName];
      if (mappedValue) {
        const commonPrefix = findCommonPrefixDifference(clusterName, mappedValue);
        if (commonPrefix > 0) return clusterName.substring(commonPrefix);
      }
      for (const [key, value] of Object.entries(m.mappings)) {
        if (value === clusterName) {
          const commonPrefix = findCommonPrefixDifference(key, clusterName);
          if (commonPrefix > 0) return clusterName.substring(commonPrefix);
        }
      }
    }
    return clusterName;
  }

  private async fetchNamespaceAnnotations(
    namespaceName: string,
    clusterName: string,
  ): Promise<Record<string, string> | null> {
    const cacheKey = `${clusterName}/${namespaceName}`;
    const cached = this.namespaceAnnotationsCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const promise = (async (): Promise<Record<string, string> | null> => {
      try {
        const namespace = await this.resourceFetcher.proxyKubernetesRequest(
          clusterName,
          `/api/v1/namespaces/${namespaceName}`,
        );
        return namespace?.metadata?.annotations || null;
      } catch (error) {
        this.logger.debug(
          `Failed to fetch namespace ${namespaceName} from ${clusterName}: ${error}`,
        );
        return null;
      }
    })();

    this.namespaceAnnotationsCache.set(cacheKey, promise);
    return promise;
  }

  private async resolveOwnerWithInheritance(
    workloadAnnotations: Record<string, string>,
    namespaceName: string | undefined,
    clusterName: string,
    namespacePrefix: string,
  ): Promise<string> {
    const prefix = this.providerConfig.annotationPrefix;
    const defaultOwner = this.providerConfig.defaultOwner;
    const ownerKey = `${prefix}/owner`;

    if (workloadAnnotations[ownerKey]) {
      return resolveOwnerRef(workloadAnnotations[ownerKey], namespacePrefix, defaultOwner);
    }

    if (this.providerConfig.inheritOwnerFromNamespace && namespaceName) {
      const namespaceAnnotations = await this.fetchNamespaceAnnotations(
        namespaceName,
        clusterName,
      );
      if (namespaceAnnotations?.[ownerKey]) {
        return resolveOwnerRef(
          namespaceAnnotations[ownerKey],
          namespacePrefix,
          defaultOwner,
        );
      }
    }

    return resolveOwnerRef(undefined, namespacePrefix, defaultOwner);
  }

  private extractCustomAnnotations(
    annotations: Record<string, string>,
    clusterName: string,
  ): Record<string, string> {
    const prefix = this.providerConfig.annotationPrefix;
    const defaults: Record<string, string> = {
      'backstage.io/managed-by-location': `cluster origin: ${clusterName}`,
      'backstage.io/managed-by-origin-location': `cluster origin: ${clusterName}`,
    };
    const customKey = `${prefix}/component-annotations`;
    if (!annotations[customKey]) return defaults;

    return (splitAnnotationValues(annotations[customKey]) || []).reduce(
      (acc, pair) => {
        const sep = pair.indexOf('=');
        if (sep !== -1) {
          const key = pair.substring(0, sep).trim();
          const value = pair.substring(sep + 1).trim();
          if (key && value) acc[key] = value;
        }
        return acc;
      },
      defaults,
    );
  }

  private extractCustomTags(metadata: any): string[] {
    const prefix = this.providerConfig.annotationPrefix;
    const annotations = metadata.annotations || {};
    const tagsKey = `${prefix}/backstage-tags`;
    const sanitize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9+#]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!annotations[tagsKey]) return [];

    const parsed = (splitAnnotationValues(annotations[tagsKey]) || []).reduce(
      (acc: Record<string, string>, pair) => {
        const sep = pair.indexOf(':');
        if (sep !== -1) {
          const key = pair.substring(0, sep).trim();
          const value = pair.substring(sep + 1).trim();
          if (key && value) acc[key] = value;
        }
        return acc;
      },
      {},
    );

    return Object.entries(parsed)
      .map(([k, v]) => {
        const sk = sanitize(k);
        const sv = sanitize(v);
        if (!sk || !sv) return '';
        return `${sk}:${sv}`.substring(0, 63).replace(/-+$/g, '');
      })
      .filter((tag): tag is string => Boolean(tag && tag.includes(':')));
  }

  private extractArgoAppName(
    annotations: Record<string, string>,
  ): Record<string, string> {
    if (!this.providerConfig.argoIntegration) return {};
    const trackingId = annotations['argocd.argoproj.io/tracking-id'];
    if (!trackingId) return {};
    const appName = trackingId.split(':')[0];
    if (!appName) return {};
    return { 'argocd/app-name': appName };
  }

  private findCommonLabels(resource: any): string | null {
    const highLevel = resource.metadata.labels || {};
    const pod = resource.spec?.template?.metadata?.labels || {};
    const common = Object.keys(highLevel).filter(l => pod[l]);
    if (common.length > 0) {
      return common.map(l => `${l}=${highLevel[l]}`).join(',');
    }
    if (Object.keys(highLevel).length > 0) {
      return Object.keys(highLevel)
        .map(l => `${l}=${highLevel[l]}`)
        .join(',');
    }
    return null;
  }

  private parseBackstageLinks(
    annotations: Record<string, string>,
  ): BackstageLink[] {
    const prefix = this.providerConfig.annotationPrefix;
    const raw = annotations[`${prefix}/links`];
    if (!raw) return [];
    try {
      const links = JSON.parse(raw) as BackstageLink[];
      return links.map(l => ({
        url: l.url,
        title: l.title,
        icon: l.icon,
        type: l.type,
      }));
    } catch (error) {
      this.logger.warn(`Failed to parse ${prefix}/links annotation: ${error}`);
      return [];
    }
  }

  private createApiEntity(
    componentName: string,
    componentTitle: string,
    componentNamespace: string,
    clusterName: string,
    definition: string,
    owner: string,
    system: string,
    useTextReference: boolean,
  ): Entity | undefined {
    const prefix = this.providerConfig.annotationPrefix;
    const definitionValue = useTextReference ? { $text: definition } : definition;
    const apiEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: componentName,
        namespace: componentNamespace,
        title: `${componentTitle} API`,
        description: `API provided by ${componentTitle}`,
        annotations: {
          'backstage.io/managed-by-location': `cluster origin: ${clusterName}`,
          'backstage.io/managed-by-origin-location': `cluster origin: ${clusterName}`,
          [`${prefix}/auto-generated-api`]: 'true',
        },
        tags: [`cluster:${this.getNormalizedClusterName(clusterName)}`],
      },
      spec: {
        type: 'openapi',
        lifecycle: 'production',
        owner,
        system,
        definition: definitionValue,
      },
    };
    return this.validateEntityName(apiEntity) ? apiEntity : undefined;
  }

  private async fetchAndCreateApiEntity(
    annotations: Record<string, string>,
    componentName: string,
    componentTitle: string,
    componentNamespace: string,
    clusterName: string,
    defaultNamespace: string,
    owner: string,
    system: string,
  ): Promise<{ entity: Entity; ref: string } | null> {
    try {
      const result = await this.apiDefinitionFetcher.fetchApiFromAnnotations(
        annotations,
        clusterName,
        defaultNamespace,
      );
      if (!result) return null;
      if (!result.success) {
        this.logger.warn(
          `Failed to fetch API for ${componentName}: ${result.error}`,
        );
        return null;
      }

      const apiEntity = this.createApiEntity(
        componentName,
        componentTitle,
        componentNamespace,
        clusterName,
        result.definition!,
        owner,
        system,
        result.useTextReference ?? false,
      );
      if (!apiEntity) return null;

      const apiRef =
        componentNamespace === 'default'
          ? componentName
          : `${componentNamespace}/${componentName}`;
      return { entity: apiEntity, ref: apiRef };
    } catch (error) {
      this.logger.warn(
        `Error processing API annotations for ${componentName}: ${error}`,
      );
      return null;
    }
  }

  private async translateToEntities(resource: any): Promise<Entity[]> {
    const { annotationPrefix: prefix, mappings, components } = this.providerConfig;
    const namespace = resource.metadata.namespace || 'default';
    const annotations = resource.metadata.annotations || {};
    const normalizedClusterName = this.getNormalizedClusterName(resource.clusterName);

    const systemNamespaceValue = deriveSystemNamespace(
      mappings.namespaceModel,
      namespace,
      normalizedClusterName,
    );
    const systemNameValue = deriveSystemName(
      mappings.systemModel,
      namespace,
      resource,
      normalizedClusterName,
    );
    const systemReferencesNamespaceValue =
      mappings.referencesNamespaceModel === 'same'
        ? systemNamespaceValue
        : 'default';
    const nameValue = deriveEntityName(
      mappings.nameModel,
      resource,
      namespace,
      normalizedClusterName,
    );
    const titleValue = deriveEntityTitle(
      mappings.titleModel,
      resource,
      namespace,
      normalizedClusterName,
    );

    const customAnnotations = this.extractCustomAnnotations(
      annotations,
      resource.clusterName,
    );
    const argoAnnotations = this.extractArgoAppName(annotations);
    const customTags = this.extractCustomTags(resource.metadata);

    if (!annotations[`${prefix}/kubernetes-label-selector`]) {
      if (['Deployment', 'StatefulSet', 'DaemonSet', 'CronJob'].includes(resource.kind)) {
        const common = this.findCommonLabels(resource);
        if (common) customAnnotations['backstage.io/kubernetes-label-selector'] = common;
      }
    } else {
      customAnnotations['backstage.io/kubernetes-label-selector'] =
        annotations[`${prefix}/kubernetes-label-selector`];
    }

    if (resource.apiVersion) {
      const [apiGroup, version] = resource.apiVersion.includes('/')
        ? resource.apiVersion.split('/')
        : ['', resource.apiVersion];
      const kindPlural = pluralize(resource.kind);
      const objectName = resource.metadata.name;
      const uri = resource.metadata.namespace
        ? `/apis/${apiGroup}/${version}/namespaces/${namespace}/${kindPlural}/${objectName}`
        : `/apis/${apiGroup}/${version}/${kindPlural}/${objectName}`;
      customAnnotations[`${prefix}/custom-workload-uri`] = uri.toLowerCase();
    }

    if (annotations[`${prefix}/source-code-repo-url`]) {
      const repoUrl = `url:${annotations[`${prefix}/source-code-repo-url`]}`;
      customAnnotations['backstage.io/source-location'] = repoUrl;
      const branch = annotations[`${prefix}/source-branch`] || 'main';
      const techdocsPath = annotations[`${prefix}/techdocs-path`];
      if (techdocsPath) {
        customAnnotations['backstage.io/techdocs-ref'] =
          `${repoUrl}/blob/${branch}/${techdocsPath}`;
      }
    }

    const systemOwner = await this.resolveOwnerWithInheritance(
      annotations,
      namespace,
      resource.clusterName,
      systemReferencesNamespaceValue,
    );

    const systemEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: {
        name: systemNameValue,
        namespace: annotations[`${prefix}/backstage-namespace`] || systemNamespaceValue,
        annotations: customAnnotations,
      },
      spec: {
        owner: systemOwner,
        type: annotations[`${prefix}/system-type`] || 'kubernetes-namespace',
        ...(annotations[`${prefix}/domain`]
          ? { domain: annotations[`${prefix}/domain`] }
          : {}),
      },
    };

    const ingestAsResources =
      resource.ingestAsResources ?? components.ingestAsResources;
    const entityKind = ingestAsResources ? 'Resource' : 'Component';

    const componentName = annotations[`${prefix}/name`] || nameValue;
    const componentTitle = annotations[`${prefix}/title`] || titleValue;
    const componentNamespace =
      annotations[`${prefix}/backstage-namespace`] || systemNamespaceValue;
    const componentOwner = systemOwner;
    const explicitSystem = annotations[`${prefix}/system`];
    const componentSystem = this.providerConfig.createSystemFromNamespace
      ? explicitSystem ||
        `${systemReferencesNamespaceValue}/${systemNameValue}`
      : explicitSystem;

    let apiEntity: Entity | undefined;
    let apiRef: string | undefined;
    if (entityKind === 'Component') {
      const apiResult = await this.fetchAndCreateApiEntity(
        annotations,
        componentName,
        componentTitle,
        componentNamespace,
        resource.clusterName,
        namespace,
        componentOwner,
        componentSystem ?? '',
      );
      if (apiResult) {
        apiEntity = apiResult.entity;
        apiRef = apiResult.ref;
      }
    }

    let providesApis: string[] | undefined;
    if (entityKind === 'Component') {
      const existing = splitAnnotationValues(annotations[`${prefix}/providesApis`]) || [];
      if (apiRef) providesApis = [...existing, apiRef];
      else if (existing.length > 0) providesApis = existing;
    }

    const shouldTagCluster =
      mappings.systemModel === 'cluster-namespace' ||
      mappings.namespaceModel === 'cluster';

    const componentEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: entityKind,
      metadata: {
        name: componentName,
        title: componentTitle,
        description:
          annotations[`${prefix}/description`] ||
          `${resource.kind} ${resource.metadata.name} from ${resource.clusterName}`,
        namespace: componentNamespace,
        links: this.parseBackstageLinks(annotations),
        annotations: {
          ...Object.fromEntries(
            Object.entries(annotations).filter(
              ([key]) => key !== `${prefix}/links`,
            ),
          ),
          [`${prefix}/kubernetes-resource-kind`]: resource.kind,
          [`${prefix}/kubernetes-resource-name`]: resource.metadata.name,
          [`${prefix}/kubernetes-resource-api-version`]: resource.apiVersion,
          [`${prefix}/kubernetes-resource-namespace`]:
            resource.metadata.namespace || '',
          ...customAnnotations,
          ...argoAnnotations,
          ...(shouldTagCluster
            ? { 'backstage.io/kubernetes-cluster': this.mapClusterName(resource.clusterName) }
            : {}),
          ...(resource.metadata.namespace
            ? { 'backstage.io/kubernetes-namespace': resource.metadata.namespace }
            : {}),
        },
        tags: [
          `cluster:${normalizedClusterName}`,
          `kind:${resource.kind?.toLowerCase()}`,
          ...customTags,
        ],
      },
      spec: {
        type:
          annotations[`${prefix}/component-type`] ||
          resource.workloadType ||
          'service',
        lifecycle: annotations[`${prefix}/lifecycle`] || 'production',
        owner: componentOwner,
        ...(componentSystem ? { system: componentSystem } : {}),
        dependsOn: splitAnnotationValues(annotations[`${prefix}/dependsOn`]),
        ...(entityKind === 'Component'
          ? {
              providesApis,
              consumesApis: splitAnnotationValues(annotations[`${prefix}/consumesApis`]),
            }
          : {}),
        ...(annotations[`${prefix}/subcomponent-of`] && {
          subcomponentOf: annotations[`${prefix}/subcomponent-of`],
        }),
      },
    };

    const entities: Entity[] = [];
    if (
      this.providerConfig.createSystemFromNamespace &&
      this.validateEntityName(systemEntity)
    ) {
      entities.push(systemEntity);
    }
    if (this.validateEntityName(componentEntity)) entities.push(componentEntity);
    if (apiEntity) entities.push(apiEntity);
    return entities;
  }
}

function findCommonPrefixDifference(a: string, b: string): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a.substring(i) === b.substring(i)) return i;
  }
  return 0;
}

function deriveSystemNamespace(
  model: string,
  namespace: string,
  normalizedClusterName: string,
): string {
  switch (model.toLowerCase()) {
    case 'cluster':
      return normalizedClusterName;
    case 'namespace':
      return namespace || 'default';
    default:
      return 'default';
  }
}

function deriveSystemName(
  model: string,
  namespace: string,
  resource: any,
  normalizedClusterName: string,
): string {
  switch (model.toLowerCase()) {
    case 'cluster':
      return normalizedClusterName;
    case 'cluster-namespace':
      return resource.metadata.namespace
        ? `${normalizedClusterName}-${resource.metadata.namespace}`
        : normalizedClusterName;
    case 'namespace':
      return namespace || resource.metadata.name;
    default:
      return 'default';
  }
}

function deriveEntityName(
  model: string,
  resource: any,
  namespace: string,
  normalizedClusterName: string,
): string {
  switch (model.toLowerCase()) {
    case 'uid':
      return resource.metadata.uid;
    case 'name-kind':
      return `${resource.metadata.name}-${resource.kind.toLowerCase()}`;
    case 'name-cluster':
      return `${resource.metadata.name}-${normalizedClusterName}`;
    case 'name-namespace':
      return `${resource.metadata.name}-${namespace}`;
    default:
      return resource.metadata.name;
  }
}

function deriveEntityTitle(
  model: string,
  resource: any,
  namespace: string,
  normalizedClusterName: string,
): string {
  switch (model.toLowerCase()) {
    case 'name-cluster':
      return `${resource.metadata.name}-${normalizedClusterName}`;
    case 'name-namespace':
      return `${resource.metadata.name}-${namespace}`;
    default:
      return resource.metadata.name;
  }
}
