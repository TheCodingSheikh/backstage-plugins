import { useEffect, useRef } from 'react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { catalogApiRef, CatalogApi } from '@backstage/plugin-catalog-react';
import { FieldExtensionComponentProps } from '@backstage/plugin-scaffolder-react';
import { search } from '@metrichor/jmespath';
import {
  ScaffolderFieldValidatorConfig,
  ScaffolderFieldValidatorConfigSchema
} from './schema';


export interface ValidatorValue {
  exists: boolean;
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

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return String(context[key] ?? '');
  });
}

export const ScaffolderFieldValidator = (
  props: FieldExtensionComponentProps<string>
) => {
  const { formContext, uiSchema, onChange } = props;
  const catalogApi = useApi(catalogApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const prevWatchedValueRef = useRef<string | undefined>(undefined);

  const optionsResult = ScaffolderFieldValidatorConfigSchema.safeParse(
    uiSchema?.['ui:options']
  );

  const options: ScaffolderFieldValidatorConfig | undefined = optionsResult.success
    ? optionsResult.data
    : undefined;

  const watchedFieldName = options?.watchField;
  const watchedValue = watchedFieldName
    ? get(formContext?.formData, watchedFieldName) as string | undefined
    : undefined;

  useEffect(() => {
    if (!options || !watchedFieldName) {
      return;
    }

    if (watchedValue === prevWatchedValueRef.current) {
      return;
    }
    prevWatchedValueRef.current = watchedValue;

    if (!watchedValue || watchedValue.trim() === '') {
      onChange(undefined);
      return;
    }

    const validateAsync = async () => {
      try {
        let exists = false;

        if (options.validationType === 'catalog') {
          exists = await checkCatalogEntity(
            catalogApi,
            watchedValue,
            options.entityKind,
            options.catalogFilter
          );
        } else if (options.validationType === 'api') {
          exists = await checkApiEndpoint(
            discoveryApi,
            fetchApi,
            watchedValue,
            options,
            formContext?.formData
          );
        }

        if (exists) {
          const validatorValue: ValidatorValue = {
            exists: true,
            errorMessage: options.errorMessage,
            watchedValue: watchedValue,
          };
          onChange(JSON.stringify(validatorValue));
        } else {
          onChange(undefined);
        }
      } catch (_error) {
        onChange(undefined);
      }
    };

    validateAsync();
  }, [watchedValue, watchedFieldName, options, catalogApi, discoveryApi, fetchApi, onChange, formContext?.formData]);

  return null;
};

/**
 * Check if an entity exists in the Backstage catalog
 */
async function checkCatalogEntity(
  catalogApi: CatalogApi,
  name: string,
  entityKind?: string,
  catalogFilter?: Record<string, string>
): Promise<boolean> {
  try {
    const filter: Record<string, string> = {
      ...catalogFilter,
      'metadata.name': name,
    };

    if (entityKind) {
      filter.kind = entityKind;
    }

    const response = await catalogApi.getEntities({
      filter: [filter],
      limit: 1,
    });

    return response.items.length > 0;
  } catch (_error) {
    return false;
  }
}

/**
 * Check if a value exists via Backstage backend API endpoint
 * Uses JMESPath expressions to extract and check values from the response
 */
async function checkApiEndpoint(
  discoveryApi: { getBaseUrl: (pluginId: string) => Promise<string> },
  fetchApi: { fetch: typeof fetch },
  value: string,
  options: ScaffolderFieldValidatorConfig,
  formData?: Record<string, unknown>
): Promise<boolean> {
  if (!options.apiPath) {
    return false;
  }

  try {
    const baseUrl = await discoveryApi.getBaseUrl('');

    const params = new URLSearchParams();
    const templateContext = { value, ...formData };

    if (options.params) {
      Object.entries(options.params).forEach(([key, val]) => {
        const resolvedValue = typeof val === 'string'
          ? renderTemplate(val, templateContext)
          : String(val);
        params.append(key, resolvedValue);
      });
    }

    const renderedPath = renderTemplate(options.apiPath, templateContext);

    const url = `${baseUrl}${renderedPath}?${params.toString()}`;

    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const response = await fetchApi.fetch(url, fetchOptions);

    if (!response.ok) {
      return false;
    }

    const body = await response.json();

    if (options.jmesPath) {
      const renderedJmesPath = renderTemplate(options.jmesPath, templateContext);

      const result = search(body, renderedJmesPath);

      if (Array.isArray(result)) {
        return result.length > 0 && (
          result.includes(value) ||
          result.some(item => item === value || (typeof item === 'object' && item !== null))
        );
      }

      if (typeof result === 'boolean') {
        return result;
      }

      return result !== null && result !== undefined && result !== '';
    }

    if (Array.isArray(body)) {
      return body.length > 0;
    }

    return false;
  } catch (_error) {
    return false;
  }
}
