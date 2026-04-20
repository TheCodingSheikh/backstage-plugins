import { useEffect, useRef } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { search } from '@metrichor/jmespath';
import {
  ScaffolderFieldValidatorConfig,
  ScaffolderFieldValidatorConfigSchema,
} from './schema';

export interface ValidatorValue {
  failed: boolean;
  errorMessage?: string;
  watchedValue?: string;
}

function get(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let result: unknown = obj;
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return undefined;
    }
    result = (result as Record<string, unknown>)[key];
  }
  return result;
}

function renderTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return String(context[key] ?? '');
  });
}

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === false) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * Resolves apiPath to a full URL using the discovery API.
 * The first path segment is used as the plugin ID.
 * e.g. "catalog/entities" → getBaseUrl("catalog") + "/entities"
 */
async function resolveUrl(
  discoveryApi: { getBaseUrl: (pluginId: string) => Promise<string> },
  apiPath: string,
  params?: URLSearchParams,
): Promise<string> {
  const segments = apiPath.replace(/^\//, '').split('/');
  const pluginId = segments[0];
  const restPath = segments.length > 1 ? `/${segments.slice(1).join('/')}` : '';
  const baseUrl = await discoveryApi.getBaseUrl(pluginId);
  const query = params?.toString();
  return query ? `${baseUrl}${restPath}?${query}` : `${baseUrl}${restPath}`;
}

export const ScaffolderFieldValidator = (
  props: FieldExtensionComponentProps<string>,
) => {
  const { formContext, uiSchema, onChange } = props;
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const prevWatchedValueRef = useRef<string | undefined>(undefined);

  const optionsResult = ScaffolderFieldValidatorConfigSchema.safeParse(
    uiSchema?.['ui:options'],
  );

  const options: ScaffolderFieldValidatorConfig | undefined =
    optionsResult.success ? optionsResult.data : undefined;

  const watchedFieldName = options?.watchField;
  const watchedValue = watchedFieldName
    ? (get(formContext?.formData, watchedFieldName) as string | undefined)
    : undefined;

  useEffect(() => {
    if (!options || !watchedFieldName) {
      return;
    }

    if (watchedValue === prevWatchedValueRef.current) {
      return;
    }
    prevWatchedValueRef.current = watchedValue;

    if (!watchedValue || String(watchedValue).trim() === '') {
      onChange(undefined);
      return;
    }

    if (options.skipIfUnchanged) {
      const originals = get(
        formContext?.formData,
        '__originalFormValues',
      ) as Record<string, unknown> | undefined;
      const originalValue = originals
        ? (get(originals, watchedFieldName) as string | undefined)
        : undefined;
      if (originalValue !== undefined && originalValue === watchedValue) {
        onChange(undefined);
        return;
      }
    }

    const validateAsync = async () => {
      try {
        const templateContext: Record<string, unknown> = {
          value: watchedValue,
          ...formContext?.formData,
        };

        // Build query params
        const params = new URLSearchParams();
        if (options.params) {
          for (const [key, val] of Object.entries(options.params)) {
            params.append(
              key,
              typeof val === 'string'
                ? renderTemplate(val, templateContext)
                : String(val),
            );
          }
        }

        // Resolve URL and fetch
        const renderedPath = renderTemplate(options.apiPath, templateContext);
        const url = await resolveUrl(discoveryApi, renderedPath, params);
        const response = await fetchApi.fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          onChange(undefined);
          return;
        }

        const body = await response.json();

        // Evaluate: jmesPath if provided, otherwise raw truthiness
        let failed: boolean;
        if (options.jmesPath) {
          const expr = renderTemplate(options.jmesPath, templateContext);
          failed = isTruthy(search(body, expr));
        } else {
          failed = isTruthy(body);
        }

        if (failed) {
          const result: ValidatorValue = {
            failed: true,
            errorMessage: options.errorMessage,
            watchedValue: String(watchedValue),
          };
          onChange(JSON.stringify(result));
        } else {
          onChange(undefined);
        }
      } catch (_error) {
        onChange(undefined);
      }
    };

    validateAsync();
  }, [
    watchedValue,
    watchedFieldName,
    options,
    discoveryApi,
    fetchApi,
    onChange,
    formContext?.formData,
  ]);

  return null;
};
