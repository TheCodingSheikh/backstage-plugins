import {
  AuthService,
  DiscoveryService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import fetch from 'node-fetch';

export interface KubernetesResourceFetcherOptions {
  clusterName: string;
  namespace?: string;
  resourcePath: string;
  query?: Record<string, string>;
}

export interface KubernetesResourceFetcher {
  getClusters(): Promise<string[]>;
  fetchResources<T>(options: KubernetesResourceFetcherOptions): Promise<T[]>;
  fetchResource<T>(options: KubernetesResourceFetcherOptions): Promise<T>;
  proxyKubernetesRequest(clusterName: string, path: string): Promise<any>;
}

/**
 * Talks to the core kubernetes plugin over its discovery URL and proxy
 * endpoint. Cluster discovery and authentication are therefore driven
 * entirely by `kubernetes.clusterLocatorMethods` in app-config.
 */
export class DefaultKubernetesResourceFetcher
  implements KubernetesResourceFetcher
{
  // Auth providers that require client-side credentials (no server-to-server path).
  private static readonly EXCLUDED_AUTH_PROVIDERS = ['oidc'];

  constructor(
    private readonly discoveryApi: DiscoveryService,
    private readonly auth: AuthService,
    private readonly logger: LoggerService,
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const credentials = await this.auth.getOwnServiceCredentials();
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: credentials,
      targetPluginId: 'kubernetes',
    });
    return {
      Authorization: `Bearer ${token}`,
      'X-Kubernetes-Catalog-Provider': 'true',
    };
  }

  async getClusters(): Promise<string[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('kubernetes');
    const response = await fetch(`${baseUrl}/clusters`, {
      headers: await this.authHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch clusters: ${response.statusText}`);
    }
    const clusters = (await response.json()) as { items: any[] };
    return clusters.items
      .filter(cluster => {
        const authProvider = cluster.authProvider?.toLowerCase();
        return !(
          authProvider &&
          DefaultKubernetesResourceFetcher.EXCLUDED_AUTH_PROVIDERS.includes(
            authProvider,
          )
        );
      })
      .map(cluster => cluster.name);
  }

  async fetchResources<T>(
    options: KubernetesResourceFetcherOptions,
  ): Promise<T[]> {
    const { clusterName, namespace, resourcePath, query } = options;
    const baseUrl = await this.discoveryApi.getBaseUrl('kubernetes');

    let path = `/apis/${resourcePath}`;
    const params = new URLSearchParams();
    if (namespace) params.set('namespace', namespace);
    if (query) {
      for (const [k, v] of Object.entries(query)) params.set(k, v);
    }
    const qs = params.toString();
    if (qs) path += `?${qs}`;

    const response = await fetch(`${baseUrl}/proxy${path}`, {
      headers: {
        ...(await this.authHeaders()),
        'Backstage-Kubernetes-Cluster': clusterName,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(
        `Failed to fetch ${resourcePath} from ${clusterName}: ${response.statusText}`,
      );
    }
    const data = (await response.json()) as { items?: T[] };
    return data.items ?? [];
  }

  async fetchResource<T>(
    options: KubernetesResourceFetcherOptions,
  ): Promise<T> {
    const { clusterName, namespace, resourcePath } = options;
    const baseUrl = await this.discoveryApi.getBaseUrl('kubernetes');
    const path = namespace
      ? `/apis/${resourcePath}?namespace=${namespace}`
      : `/apis/${resourcePath}`;

    const response = await fetch(`${baseUrl}/proxy${path}`, {
      headers: {
        ...(await this.authHeaders()),
        'Backstage-Kubernetes-Cluster': clusterName,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch resource ${resourcePath} from ${clusterName}: ${response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }

  async proxyKubernetesRequest(
    clusterName: string,
    path: string,
  ): Promise<any> {
    const baseUrl = await this.discoveryApi.getBaseUrl('kubernetes');
    const response = await fetch(`${baseUrl}/proxy${path}`, {
      headers: {
        ...(await this.authHeaders()),
        'Backstage-Kubernetes-Cluster': clusterName,
      },
    });
    if (!response.ok) {
      this.logger.debug(
        `proxyKubernetesRequest ${path} on ${clusterName} failed: ${response.statusText}`,
      );
      throw new Error(
        `Failed to fetch via kubernetes proxy: ${response.statusText}`,
      );
    }
    return response.json();
  }
}
