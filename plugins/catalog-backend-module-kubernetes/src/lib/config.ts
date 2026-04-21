import {
  readSchedulerServiceTaskScheduleDefinitionFromConfig,
  SchedulerServiceTaskScheduleDefinition,
} from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';

export type ClusterNameMappingConfig = {
  mode?: 'prefix-replacement' | 'explicit';
  sourcePrefix?: string;
  targetPrefix?: string;
  mappings?: Record<string, string>;
};

export type CustomWorkloadType = {
  group: string;
  apiVersion: string;
  plural: string;
  singular?: string;
  defaultType?: string;
  ingestAsResources?: boolean;
};

export type ComponentsConfig = {
  enabled: boolean;
  ingestAsResources: boolean;
  onlyIngestAnnotatedResources: boolean;
  excludedNamespaces: string[];
  customWorkloadTypes: CustomWorkloadType[];
  disableDefaultWorkloadTypes: boolean;
};

export type CrdsConfig = {
  enabled: boolean;
  ingestAPIsAsCRDs: boolean;
  system: string;
  crds: string[];
  crdLabelSelector?: { key: string; value: string };
};

export type MappingsConfig = {
  namespaceModel: string;
  nameModel: string;
  titleModel: string;
  systemModel: string;
  referencesNamespaceModel: string;
};

export type KubernetesProviderConfig = {
  id: string;
  annotationPrefix: string;
  defaultOwner: string;
  inheritOwnerFromNamespace: boolean;
  allowedClusterNames?: string[];
  maxConcurrency: number;
  clusterNameMapping?: ClusterNameMappingConfig;
  argoIntegration: boolean;
  createSystemFromNamespace: boolean;
  mappings: MappingsConfig;
  components: ComponentsConfig;
  crds: CrdsConfig;
  schedule?: SchedulerServiceTaskScheduleDefinition;
};

const DEFAULT_SCHEDULE: SchedulerServiceTaskScheduleDefinition = {
  frequency: { seconds: 600 },
  timeout: { seconds: 600 },
};

function readComponentsConfig(c?: Config): ComponentsConfig {
  if (!c) {
    return {
      enabled: true,
      ingestAsResources: false,
      onlyIngestAnnotatedResources: false,
      excludedNamespaces: [],
      customWorkloadTypes: [],
      disableDefaultWorkloadTypes: false,
    };
  }
  const customWorkloadTypes =
    c.getOptionalConfigArray('customWorkloadTypes')?.map(t => ({
      group: t.getString('group'),
      apiVersion: t.getString('apiVersion'),
      plural: t.getString('plural'),
      singular: t.getOptionalString('singular'),
      defaultType: t.getOptionalString('defaultType'),
      ingestAsResources: t.getOptionalBoolean('ingestAsResources'),
    })) ?? [];

  return {
    enabled: c.getOptionalBoolean('enabled') ?? true,
    ingestAsResources: c.getOptionalBoolean('ingestAsResources') ?? false,
    onlyIngestAnnotatedResources:
      c.getOptionalBoolean('onlyIngestAnnotatedResources') ?? false,
    excludedNamespaces: c.getOptionalStringArray('excludedNamespaces') ?? [],
    customWorkloadTypes,
    disableDefaultWorkloadTypes:
      c.getOptionalBoolean('disableDefaultWorkloadTypes') ?? false,
  };
}

function readCrdsConfig(c?: Config): CrdsConfig {
  if (!c) {
    return {
      enabled: false,
      ingestAPIsAsCRDs: true,
      system: 'crds',
      crds: [],
    };
  }
  const sel = c.getOptionalConfig('crdLabelSelector');
  return {
    enabled: c.getOptionalBoolean('enabled') ?? false,
    ingestAPIsAsCRDs: c.getOptionalBoolean('ingestAPIsAsCRDs') ?? true,
    system: c.getOptionalString('system') ?? 'crds',
    crds: c.getOptionalStringArray('crds') ?? [],
    crdLabelSelector: sel
      ? { key: sel.getString('key'), value: sel.getString('value') }
      : undefined,
  };
}

function readMappingsConfig(c?: Config): MappingsConfig {
  return {
    namespaceModel: c?.getOptionalString('namespaceModel') ?? 'default',
    nameModel: c?.getOptionalString('nameModel') ?? 'name',
    titleModel: c?.getOptionalString('titleModel') ?? 'name',
    systemModel: c?.getOptionalString('systemModel') ?? 'namespace',
    referencesNamespaceModel:
      c?.getOptionalString('referencesNamespaceModel') ?? 'default',
  };
}

function readClusterNameMapping(
  c?: Config,
): ClusterNameMappingConfig | undefined {
  if (!c) return undefined;
  const mode = c.getOptionalString('mode');
  const mappingsConfig = c.getOptionalConfig('mappings');
  const mappings: Record<string, string> | undefined = mappingsConfig
    ? Object.fromEntries(
        mappingsConfig.keys().map(k => [k, mappingsConfig.getString(k)]),
      )
    : undefined;
  return {
    mode: mode as 'prefix-replacement' | 'explicit' | undefined,
    sourcePrefix: c.getOptionalString('sourcePrefix'),
    targetPrefix: c.getOptionalString('targetPrefix'),
    mappings,
  };
}

function readProviderConfig(id: string, c: Config): KubernetesProviderConfig {
  const schedule = c.has('schedule')
    ? readSchedulerServiceTaskScheduleDefinitionFromConfig(c.getConfig('schedule'))
    : undefined;

  return {
    id,
    annotationPrefix:
      c.getOptionalString('annotationPrefix') ?? 'k8s.backstage.io',
    defaultOwner:
      c.getOptionalString('defaultOwner') ?? 'kubernetes-auto-ingested',
    inheritOwnerFromNamespace:
      c.getOptionalBoolean('inheritOwnerFromNamespace') ?? false,
    allowedClusterNames: c.getOptionalStringArray('allowedClusterNames'),
    maxConcurrency: c.getOptionalNumber('maxConcurrency') ?? 20,
    clusterNameMapping: readClusterNameMapping(
      c.getOptionalConfig('clusterNameMapping'),
    ),
    argoIntegration: c.getOptionalBoolean('argoIntegration') ?? false,
    createSystemFromNamespace:
      c.getOptionalBoolean('createSystemFromNamespace') ?? true,
    mappings: readMappingsConfig(c.getOptionalConfig('mappings')),
    components: readComponentsConfig(c.getOptionalConfig('components')),
    crds: readCrdsConfig(c.getOptionalConfig('crds')),
    schedule,
  };
}

export function readProviderConfigs(config: Config): KubernetesProviderConfig[] {
  const providers = config.getOptionalConfig('catalog.providers.kubernetes');
  if (!providers) return [];
  return providers.keys().map(id =>
    readProviderConfig(id, providers.getConfig(id)),
  );
}

export { DEFAULT_SCHEDULE };
