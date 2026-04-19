import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { DefaultKubernetesResourceFetcher } from '../services';

export class CRDDataProvider {
  constructor(
    private readonly resourceFetcher: DefaultKubernetesResourceFetcher,
    private readonly config: Config,
    private readonly logger: LoggerService,
  ) {}

  async fetchCRDObjects(): Promise<any[]> {
    try {
      // Get allowed clusters from config or discover them
      const allowedClusters = this.config.getOptionalStringArray('kubernetesIngestor.allowedClusterNames');
      let clusters: string[] = [];
      
      if (allowedClusters) {
        clusters = allowedClusters;
      } else {
        try {
          clusters = await this.resourceFetcher.getClusters();
        } catch (error) {
          this.logger.error('Failed to discover clusters:', error instanceof Error ? error : { error: String(error) });
          return [];
        }
      }

      if (clusters.length === 0) {
        this.logger.warn('No clusters found.');
        return [];
      }

      const crdTargets = this.config.getOptionalStringArray(
        'kubernetesIngestor.genericCRDTemplates.crds',
      );
      const labelSelector = this.config.getOptionalConfig(
        'kubernetesIngestor.genericCRDTemplates.crdLabelSelector',
      );
      if (!crdTargets && !labelSelector) {
        return [];
      }

      if (crdTargets && labelSelector) {
        this.logger.warn(
          'Both CRD targets and label selector are configured. Only one should be used. Using CRD targets.',
        );
        return [];
      }

      const crdMap = new Map<string, any>();
      for (const clusterName of clusters) {
        try {
          let labelSelectorString = '';
          if (labelSelector) {
            const key = labelSelector.getString('key');
            const value = labelSelector.getString('value');
            labelSelectorString = `${key}=${value}`;
          }

          const fetchedObjects = await this.resourceFetcher.fetchResources({
            clusterName,
            resourcePath: 'apiextensions.k8s.io/v1/customresourcedefinitions',
            query: labelSelector ? { labelSelector: labelSelectorString } : undefined
          });

          if (crdTargets) {
            // Process specific CRD targets
            for (const crdTarget of crdTargets) {
              const parts = crdTarget.split('.');
              const plural = parts[0];
              const group = parts.slice(1).join('.');

              const filteredCRDs = (fetchedObjects as any[])
                .filter(
                  (crd: any) =>
                    crd.spec.group === group &&
                    crd.spec.names.plural === plural,
                )
                .map(crd => ({
                  ...crd,
                  clusterName,
                  clusterEndpoint: clusterName,
                }));

              filteredCRDs.forEach(crd => {
                const crdKey = `${crd.spec.group}/${crd.spec.names.plural}`;
                if (!crdMap.has(crdKey)) {
                  crdMap.set(crdKey, {
                    ...crd,
                    clusters: [clusterName],
                    clusterDetails: [{ name: clusterName, url: clusterName }],
                  });
                } else {
                  const existingCrd = crdMap.get(crdKey);
                  if (!existingCrd.clusters.includes(clusterName)) {
                    existingCrd.clusters.push(clusterName);
                    existingCrd.clusterDetails.push({
                      name: clusterName,
                      url: clusterName,
                    });
                  }
                }
              });
            }
          } else {
            // Process CRDs based on label selector
            const labeledCRDs = (fetchedObjects as any[])
              .map((crd: any) => ({
                ...crd,
                clusterName,
                clusterEndpoint: clusterName,
              }));
            labeledCRDs.forEach(crd => {
              const crdKey = `${crd.spec.group}/${crd.spec.names.plural}`;
              if (!crdMap.has(crdKey)) {
                crdMap.set(crdKey, {
                  ...crd,
                  clusters: [clusterName],
                  clusterDetails: [{ name: clusterName, url: clusterName }],
                });
              } else {
                const existingCrd = crdMap.get(crdKey);
                if (!existingCrd.clusters.includes(clusterName)) {
                  existingCrd.clusters.push(clusterName);
                  existingCrd.clusterDetails.push({
                    name: clusterName,
                    url: clusterName,
                  });
                }
              }
            });
          }
        } catch (error) {
          this.logger.error(
            `Failed to fetch CRD objects for cluster ${clusterName}: ${error}`,
          );
        }
      }
      return Array.from(crdMap.values());
    } catch (error) {
      this.logger.error('Error fetching CRD objects');
      throw error;
    }
  }
}

