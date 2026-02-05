import { z } from 'zod';

/**
 * Schema for the ScaffolderFieldValidator UI options
 */
export const ScaffolderFieldValidatorConfigSchema = z.object({
    watchField: z.string(),

    validationType: z.enum(['catalog', 'api']),

    entityKind: z.string().optional(),

    catalogFilter: z.record(z.string()).optional(),

    apiPath: z.string().optional(),

    params: z.record(z.any()).optional(),

    /** 
     * JMESPath expression to extract values from the API response.
     * The result should be an array of values or a single value to check against.
     * Use {{ value }} in the expression to reference the watched field value.
     * 
     * Examples:
     * - "items[*].name" - extracts name from all items
     * - "data.results[?name=='{{ value }}']" - filters for matching name
     * - "items[*].metadata.name" - nested property extraction
     */
    jmesPath: z.string().optional(),

    errorMessage: z.string().optional(),
});

export type ScaffolderFieldValidatorConfig = z.infer<typeof ScaffolderFieldValidatorConfigSchema>;

export const ScaffolderFieldValidatorSchema = {
    returnValue: {
        type: 'string' as const,
        description: 'Internal value set when validation fails (contains the duplicate name)',
    },
    uiOptions: {
        type: 'object' as const,
        properties: {
            watchField: {
                type: 'string' as const,
                description: 'The field name to watch for validation',
            },
            validationType: {
                type: 'string' as const,
                enum: ['catalog', 'api'],
                description: 'Type of validation: catalog entity check or custom API',
            },
            entityKind: {
                type: 'string' as const,
                description: 'Entity kind to check against (for catalog validation)',
            },
            catalogFilter: {
                type: 'object' as const,
                description: 'Additional catalog filter options',
            },
            apiPath: {
                type: 'string' as const,
                description: 'API path for HTTP validation',
            },
            params: {
                type: 'object' as const,
                description: 'Query parameters or body for API call',
            },
            jmesPath: {
                type: 'string' as const,
                description: 'JMESPath expression to extract and check values from API response',
            },
            errorMessage: {
                type: 'string' as const,
                description: 'Custom error message when validation fails',
            },
        },
        required: ['watchField', 'validationType'],
    },
};
