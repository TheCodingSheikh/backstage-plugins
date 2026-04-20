import { z } from 'zod';

export const ScaffolderFieldValidatorConfigSchema = z.object({
    watchField: z.string(),

    apiPath: z.string(),

    params: z.record(z.any()).optional(),

    /**
     * JMESPath expression evaluated against the API response.
     * If the result is truthy (true, non-empty array, non-null value),
     * validation fails and the error message is shown.
     *
     * Supports {{value}} to reference the watched field value,
     * and {{fieldName}} to reference other form fields.
     *
     * Examples:
     * - "length(@) > `0`"                          — response array has items
     * - "status == 'archived'"                      — field equals value
     * - "contains(items[*].name, '{{value}}')"      — array contains watched value
     * - "count > `5`"                               — numeric comparison
     * - "items[?status == 'active'] | length(@) > `0`" — filtered existence
     *
     * If omitted, validation fails when the response is a non-empty array
     * or a truthy value.
     */
    jmesPath: z.string().optional(),

    errorMessage: z.string().optional(),

    /**
     * When true, validation is skipped if the watched field's current value
     * equals its original value under `formData.__originalFormValues`.
     *
     * Intended for edit-mode embeddings (e.g. entity-scaffolder) where the
     * form is pre-filled with an entity's existing values — a uniqueness-style
     * validator would otherwise always fail against those same values.
     *
     * Changing the watched value re-runs validation normally.
     */
    skipIfUnchanged: z.boolean().optional(),
});

export type ScaffolderFieldValidatorConfig = z.infer<typeof ScaffolderFieldValidatorConfigSchema>;

export const ScaffolderFieldValidatorSchema = {
    returnValue: {
        type: 'string' as const,
        description: 'Internal JSON value set when validation fails',
    },
    uiOptions: {
        type: 'object' as const,
        properties: {
            watchField: {
                type: 'string' as const,
                description: 'The form field to watch for changes',
            },
            apiPath: {
                type: 'string' as const,
                description: 'Backend API path (e.g. "catalog/entities", "proxy/my-api/check"). First segment is the plugin ID.',
            },
            params: {
                type: 'object' as const,
                description: 'Query parameters for the API call. Values support {{value}} and {{fieldName}} templates.',
            },
            jmesPath: {
                type: 'string' as const,
                description: 'JMESPath expression to evaluate against the response. Truthy result = validation fails.',
            },
            errorMessage: {
                type: 'string' as const,
                description: 'Error message shown on failure. Supports {{value}} template.',
            },
            skipIfUnchanged: {
                type: 'boolean' as const,
                description: 'Skip validation when the watched value equals formData.__originalFormValues[watchField]. Used by edit-mode embeddings (e.g. entity-scaffolder).',
            },
        },
        required: ['watchField', 'apiPath'],
    },
};
