import type { SchedulerServiceTaskScheduleDefinitionConfig } from '@backstage/backend-plugin-api';

/**
 * Configuration schema for the Kubernetes catalog provider module.
 *
 * Cluster discovery and authentication are handled by the core Kubernetes
 * plugin via `kubernetes.clusterLocatorMethods`. This module only defines
 * ingestion-specific knobs under `catalog.providers.kubernetes`.
 */
export interface Config {
  catalog?: {
    providers?: {
      kubernetes?: {
        [id: string]: {
          /**
           * Custom annotation prefix for metadata annotations.
           * @default k8s.backstage.io
           * @visibility frontend
           */
          annotationPrefix?: string;
          /**
           * Default owner for auto-ingested entities.
           * @default kubernetes-auto-ingested
           * @visibility frontend
           */
          defaultOwner?: string;
          /**
           * Inherit the owner annotation from the workload's Namespace when
           * not set on the workload itself.
           *
           * Precedence: Workload annotation > Namespace annotation > defaultOwner
           * @default false
           * @visibility frontend
           */
          inheritOwnerFromNamespace?: boolean;
          /**
           * Subset of clusters (by name, as known to the core kubernetes
           * plugin) to ingest from. When omitted, all discoverable clusters
           * are used.
           * @visibility frontend
           */
          allowedClusterNames?: string[];
          /**
           * Maximum number of concurrent HTTP requests to the Kubernetes
           * proxy. Applies both when listing resources per cluster and when
           * translating workloads into entities (which may trigger
           * namespace-annotation and API-definition lookups).
           * @default 20
           * @visibility frontend
           */
          maxConcurrency?: number;
          /**
           * Maps backend cluster names to frontend cluster names for the
           * `backstage.io/kubernetes-cluster` annotation.
           * @visibility frontend
           */
          clusterNameMapping?: {
            /**
             * Mapping mode.
             * - `prefix-replacement`: replace source prefix with target prefix
             * - `explicit`: exact key/value mapping
             * @visibility frontend
             */
            mode?: 'prefix-replacement' | 'explicit';
            /** @visibility frontend */
            sourcePrefix?: string;
            /** @visibility frontend */
            targetPrefix?: string;
            /** @visibility frontend */
            mappings?: { [key: string]: string };
          };
          /**
           * Enable Argo CD integration: propagates `argocd.argoproj.io/tracking-id`
           * into a `argocd/app-name` annotation on ingested entities.
           * @default false
           * @visibility frontend
           */
          argoIntegration?: boolean;
          /**
           * Automatically emit a System entity for each namespace/cluster an
           * ingested workload lives in. When false, no System is emitted and
           * the Component's `spec.system` is only set if the workload carries
           * an explicit `<prefix>/system` annotation.
           * @default true
           * @visibility frontend
           */
          createSystemFromNamespace?: boolean;
          /**
           * Entity naming and organization mappings.
           */
          mappings?: {
            /** @default default @visibility frontend */
            namespaceModel?: string;
            /** @default name @visibility frontend */
            nameModel?: string;
            /** @default name @visibility frontend */
            titleModel?: string;
            /** @default namespace @visibility frontend */
            systemModel?: string;
            /** @default default @visibility frontend */
            referencesNamespaceModel?: string;
          };
          /**
           * Workload/component ingestion.
           */
          components?: {
            /** @default true @visibility frontend */
            enabled?: boolean;
            /** @default false @visibility frontend */
            ingestAsResources?: boolean;
            /** @default false @visibility frontend */
            onlyIngestAnnotatedResources?: boolean;
            /** @visibility frontend */
            excludedNamespaces?: string[];
            /**
             * Custom workload GVKs to ingest in addition to the defaults
             * (Deployments, StatefulSets, DaemonSets, CronJobs).
             * @visibility frontend
             */
            customWorkloadTypes?: Array<{
              /** @visibility frontend */
              group: string;
              /** @visibility frontend */
              apiVersion: string;
              /** @visibility frontend */
              plural: string;
              /** @visibility frontend */
              singular?: string;
              /** @default service @visibility frontend */
              defaultType?: string;
              /** @visibility frontend */
              ingestAsResources?: boolean;
            }>;
            /** @default false @visibility frontend */
            disableDefaultWorkloadTypes?: boolean;
          };
          /**
           * Generate API entities from CRDs in the cluster.
           */
          crds?: {
            /** @default false @visibility frontend */
            enabled?: boolean;
            /**
             * When true, emit API entities of type `crd` with the raw CRD
             * YAML as the definition. When false, emit type `openapi` with
             * a generated OpenAPI spec.
             * @default true
             * @visibility frontend
             */
            ingestAPIsAsCRDs?: boolean;
            /**
             * Backstage System to assign every CRD-derived API entity to
             * via `spec.system`. You typically want a matching System
             * entity in your catalog so the ref resolves.
             * @default crds
             * @visibility frontend
             */
            system?: string;
            /**
             * Explicit list of CRDs to ingest, in `<plural>.<group>` form.
             * @visibility frontend
             */
            crds?: string[];
            /**
             * Label selector for filtering CRDs. Ignored if `crds` is set.
             */
            crdLabelSelector?: {
              /** @visibility frontend */
              key?: string;
              /** @visibility frontend */
              value?: string;
            };
          };
          /**
           * Scheduler definition for the ingestion task.
           */
          schedule?: SchedulerServiceTaskScheduleDefinitionConfig;
        };
      };
    };
  };
}
