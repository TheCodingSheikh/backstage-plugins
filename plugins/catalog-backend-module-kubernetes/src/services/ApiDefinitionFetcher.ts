import { LoggerService, UrlReaderService } from '@backstage/backend-plugin-api';
import yaml from 'js-yaml';
import fetch from 'node-fetch';
import pluralize from 'pluralize';
import { KubernetesResourceFetcher } from './KubernetesResourceFetcher';

const GIT_PROVIDER_PATTERNS = [
  /^https?:\/\/(www\.)?github\.com\//i,
  /^https?:\/\/(www\.)?gitlab\.com\//i,
  /^https?:\/\/(www\.)?bitbucket\.org\//i,
  /^https?:\/\/dev\.azure\.com\//i,
  /^https?:\/\/.*\.visualstudio\.com\//i,
  /^https?:\/\/.*\.github\.io\//i,
  /^https?:\/\/raw\.githubusercontent\.com\//i,
  /^https?:\/\/gitlab\..+\//i,
  /^https?:\/\/github\..+\//i,
];

export interface ApiFromResourceRef {
  kind: string;
  name: string;
  apiVersion: string;
  namespace?: string;
  path: string;
  'target-protocol': 'http' | 'https';
  'target-port': string;
  'target-field': string;
}

export interface ApiDefinitionResult {
  success: boolean;
  definition?: string;
  error?: string;
  fetchUrl?: string;
  useTextReference?: boolean;
}

/**
 * Resolves API definitions referenced from workload annotations.
 *
 * Supported annotations (using the configured prefix):
 * - `<prefix>/provides-api-from-def`: a URL stored as a `$text` reference.
 * - `<prefix>/provides-api-from-url`: a URL whose content is fetched.
 * - `<prefix>/provides-api-from-resource-ref`: a JSON blob pointing at a
 *   Kubernetes resource whose status field yields the endpoint to fetch.
 */
export class ApiDefinitionFetcher {
  constructor(
    private readonly resourceFetcher: KubernetesResourceFetcher,
    private readonly annotationPrefix: string,
    private readonly logger: LoggerService,
    private readonly urlReader?: UrlReaderService,
  ) {}

  private isFullUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return !!parsed.protocol && !!parsed.host;
    } catch {
      return false;
    }
  }

  private getBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }

  private processServersField(apiSpec: any, fetchUrl: string): any {
    if (!apiSpec || typeof apiSpec !== 'object') return apiSpec;

    const fetchBaseUrl = this.getBaseUrl(fetchUrl);
    if (!apiSpec.servers) apiSpec.servers = [];
    if (!Array.isArray(apiSpec.servers)) return apiSpec;

    if (apiSpec.servers.length === 0) {
      apiSpec.servers = [{ url: fetchBaseUrl }];
      return apiSpec;
    }

    const firstServer = apiSpec.servers[0];
    if (!firstServer || typeof firstServer.url !== 'string') return apiSpec;

    const firstServerUrl = firstServer.url;
    if (!this.isFullUrl(firstServerUrl)) {
      apiSpec.servers[0].url = firstServerUrl.startsWith('/')
        ? `${fetchBaseUrl}${firstServerUrl}`
        : `${fetchBaseUrl}/${firstServerUrl}`;
    } else {
      const existingBaseUrl = this.getBaseUrl(firstServerUrl);
      if (existingBaseUrl !== fetchBaseUrl) {
        const fetchPath = firstServerUrl.replace(existingBaseUrl, '');
        const newServerUrl = fetchPath
          ? `${fetchBaseUrl}${fetchPath}`
          : fetchBaseUrl;
        const exists = apiSpec.servers.some(
          (s: any) => typeof s.url === 'string' && s.url === newServerUrl,
        );
        if (!exists) {
          apiSpec.servers.push({
            url: newServerUrl,
            description: 'Server based on API fetch location',
          });
        }
      }
    }
    return apiSpec;
  }

  private isGitProviderUrl(url: string): boolean {
    return GIT_PROVIDER_PATTERNS.some(p => p.test(url));
  }

  private async fetchFromUrlReader(url: string): Promise<ApiDefinitionResult> {
    if (!this.urlReader) return this.fetchFromNodeFetch(url);
    try {
      const response = await this.urlReader.readUrl(url);
      const buffer = await response.buffer();
      return this.processApiDefinitionText(buffer.toString('utf-8'), url);
    } catch (error) {
      this.logger.debug(
        `UrlReaderService failed for ${url}, falling back to node-fetch: ${error}`,
      );
      return this.fetchFromNodeFetch(url);
    }
  }

  private async fetchFromNodeFetch(url: string): Promise<ApiDefinitionResult> {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json, application/yaml, text/yaml, */*' },
        timeout: 30000,
      });
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
        };
      }
      return this.processApiDefinitionText(await response.text(), url);
    } catch (error) {
      return { success: false, error: `Error fetching ${url}: ${error}` };
    }
  }

  private processApiDefinitionText(
    text: string,
    url: string,
  ): ApiDefinitionResult {
    try {
      let apiSpec: any;
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          apiSpec = JSON.parse(text);
        } catch {
          apiSpec = yaml.load(text);
        }
      } else {
        apiSpec = yaml.load(text);
      }
      apiSpec = this.processServersField(apiSpec, url);
      return {
        success: true,
        definition: yaml.dump(apiSpec),
        fetchUrl: url,
      };
    } catch (error) {
      return { success: false, error: `Error processing ${url}: ${error}` };
    }
  }

  async fetchFromUrl(url: string): Promise<ApiDefinitionResult> {
    if (this.urlReader && this.isGitProviderUrl(url)) {
      return this.fetchFromUrlReader(url);
    }
    return this.fetchFromNodeFetch(url);
  }

  private extractValueFromPath(obj: any, path: string): string | undefined {
    if (!path || !obj) return undefined;
    const cleanPath = path.startsWith('.') ? path.substring(1) : path;
    const segments: string[] = [];
    let current = '';
    let inBracket = false;
    for (let i = 0; i < cleanPath.length; i++) {
      const char = cleanPath[i];
      if (char === '[') {
        if (current) {
          segments.push(current);
          current = '';
        }
        inBracket = true;
      } else if (char === ']') {
        if (current) {
          segments.push(`[${current}]`);
          current = '';
        }
        inBracket = false;
      } else if (char === '.' && !inBracket) {
        if (current) {
          segments.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) segments.push(current);

    let value: any = obj;
    for (const segment of segments) {
      if (value === undefined || value === null) return undefined;
      const arrayMatch = segment.match(/^\[(\d+)\]$/);
      if (arrayMatch) {
        const index = parseInt(arrayMatch[1], 10);
        if (Array.isArray(value) && index < value.length) value = value[index];
        else return undefined;
      } else {
        value = value[segment];
      }
    }
    if (value === undefined || value === null) return undefined;
    return typeof value === 'string' ? value : String(value);
  }

  async fetchFromResourceRef(
    resourceRef: ApiFromResourceRef,
    clusterName: string,
    defaultNamespace: string,
  ): Promise<ApiDefinitionResult> {
    try {
      const namespace = resourceRef.namespace || defaultNamespace;
      const [maybeGroup, maybeVersion] = resourceRef.apiVersion.split('/');
      const isCore = !maybeVersion;
      const group = isCore ? '' : maybeGroup;
      const version = isCore ? maybeGroup : maybeVersion;

      const kindPlural = pluralize(resourceRef.kind.toLowerCase());
      const resourcePath = isCore
        ? `/api/${version}/namespaces/${namespace}/${kindPlural}/${resourceRef.name}`
        : `/apis/${group}/${version}/namespaces/${namespace}/${kindPlural}/${resourceRef.name}`;

      let resource: any;
      try {
        resource = await this.resourceFetcher.proxyKubernetesRequest(
          clusterName,
          resourcePath,
        );
      } catch (fetchError) {
        return {
          success: false,
          error: `Failed to fetch ${resourceRef.kind}/${resourceRef.name}: ${fetchError}`,
        };
      }

      const endpoint = this.extractValueFromPath(
        resource,
        resourceRef['target-field'],
      );
      if (!endpoint) {
        return {
          success: false,
          error: `Could not extract endpoint from "${resourceRef['target-field']}"`,
        };
      }

      const url = `${resourceRef['target-protocol']}://${endpoint}:${resourceRef['target-port']}${resourceRef.path}`;
      return this.fetchFromUrl(url);
    } catch (error) {
      return { success: false, error: `Error processing resource ref: ${error}` };
    }
  }

  parseResourceRefAnnotation(value: string): ApiFromResourceRef | null {
    try {
      const parsed = JSON.parse(value);
      const required = [
        'kind',
        'name',
        'apiVersion',
        'path',
        'target-protocol',
        'target-port',
        'target-field',
      ];
      for (const field of required) {
        if (!parsed[field]) {
          this.logger.warn(
            `Missing "${field}" in provides-api-from-resource-ref annotation`,
          );
          return null;
        }
      }
      if (
        parsed['target-protocol'] !== 'http' &&
        parsed['target-protocol'] !== 'https'
      ) {
        this.logger.warn(
          `Invalid target-protocol in provides-api-from-resource-ref annotation`,
        );
        return null;
      }
      return parsed as ApiFromResourceRef;
    } catch (error) {
      this.logger.warn(`Failed to parse resource-ref annotation: ${error}`);
      return null;
    }
  }

  async fetchApiFromAnnotations(
    annotations: Record<string, string>,
    clusterName: string,
    defaultNamespace: string,
  ): Promise<ApiDefinitionResult | null> {
    const prefix = this.annotationPrefix;

    const defAnnotation = annotations[`${prefix}/provides-api-from-def`];
    if (defAnnotation) {
      return { success: true, definition: defAnnotation, useTextReference: true };
    }

    const urlAnnotation = annotations[`${prefix}/provides-api-from-url`];
    if (urlAnnotation) return this.fetchFromUrl(urlAnnotation);

    const resourceRefAnnotation =
      annotations[`${prefix}/provides-api-from-resource-ref`];
    if (resourceRefAnnotation) {
      const resourceRef = this.parseResourceRefAnnotation(resourceRefAnnotation);
      if (resourceRef) {
        return this.fetchFromResourceRef(resourceRef, clusterName, defaultNamespace);
      }
      return {
        success: false,
        error: 'Invalid provides-api-from-resource-ref annotation',
      };
    }

    return null;
  }
}
