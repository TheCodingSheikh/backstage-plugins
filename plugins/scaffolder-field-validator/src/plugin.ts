import { createPlugin } from '@backstage/core-plugin-api';
import type { FieldValidation } from '@rjsf/utils';
import { ApiHolder } from '@backstage/core-plugin-api';

import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';

import { ScaffolderFieldValidator, ValidatorValue } from './components/ScaffolderFieldValidator';
import { ScaffolderFieldValidatorSchema } from './components/ScaffolderFieldValidator/schema';

export const scaffolderFieldValidatorPlugin = createPlugin({
  id: 'scaffolder-field-validator',
});

const DEFAULT_ERROR_MESSAGE = 'This name already exists. Please choose a different name.';

function renderErrorMessage(template: string, watchedValue?: string): string {
  if (!watchedValue) {
    return template;
  }
  return template.replace(/\{\{\s*value\s*\}\}/g, watchedValue);
}

/**
 * Async validation function for the ScaffolderFieldValidator field extension.
 * This runs when the form is submitted to verify the name doesn't exist.
 */
export const scaffolderFieldValidatorValidation = async (
  value: string | undefined,
  validation: FieldValidation,
  _context: {
    apiHolder: ApiHolder;
    formData: Record<string, unknown>;
  },
) => {
  if (value && value.trim() !== '') {
    try {
      const parsed: ValidatorValue = JSON.parse(value);
      if (parsed.exists) {
        const errorMessage = renderErrorMessage(
          parsed.errorMessage || DEFAULT_ERROR_MESSAGE,
          parsed.watchedValue,
        );
        validation.addError(errorMessage);
      }
    } catch (_e) {
      validation.addError(DEFAULT_ERROR_MESSAGE);
    }
  }
};

export const ScaffolderFieldValidatorExtension = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'ScaffolderFieldValidator',
    component: ScaffolderFieldValidator,
    schema: ScaffolderFieldValidatorSchema,
    validation: scaffolderFieldValidatorValidation,
  }),
);