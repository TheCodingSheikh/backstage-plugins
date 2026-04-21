/*
 * Copyright SeatGeek
 * Licensed under the terms of the Apache-2.0 license. See LICENSE file in project root for terms.
 */
import { parseEntityRef } from '@backstage/catalog-model';
import { JsonObject, JsonValue } from '@backstage/types';
import {
  MissingAnnotationEmptyState,
  useEntity,
} from '@backstage/plugin-catalog-react';
import {
  ScaffolderFieldExtensions,
  SecretsContextProvider,
} from '@backstage/plugin-scaffolder-react';
import {
  EntityPickerFieldExtension,
  RepoUrlPickerFieldExtension,
  EntityNamePickerFieldExtension,
  MultiEntityPickerFieldExtension,
  OwnerPickerFieldExtension,
  MyGroupsPickerFieldExtension,
  OwnedEntityPickerFieldExtension,
  EntityTagsPickerFieldExtension,
  RepoBranchPickerFieldExtension,
} from '@backstage/plugin-scaffolder';
import { EmbeddedScaffolderWorkflow } from '@frontside/backstage-plugin-scaffolder-workflow';
import { SelectFieldFromApiExtension } from '@roadiehq/plugin-scaffolder-frontend-module-http-request-field';
import { ScaffolderFieldValidatorExtension } from '@thecodingsheikh/backstage-plugin-scaffolder-field-validator';

import {
  ENTITY_SCAFFOLDER_CONFIG_ANNOTATION,
  ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION,
  ENTITY_SCAFFOLDER_IMMUTABLE_FIELDS_ANNOTATION,
} from '../../annotations';
import { useCanEditEntityScaffolder } from '../../hooks/useCanEditEntityScaffolder';

function safeParseConfig(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {};
  } catch {
    return {};
  }
}

/**
 * Use templates from within the EntityPage.
 *
 * @public
 */
export const EntityScaffolderContent = () => {
  const { entity } = useEntity();
  const { allowed, loading } = useCanEditEntityScaffolder(entity);

  const entityScaffolderConfigAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_CONFIG_ANNOTATION];

  const entityScaffolderTemplateAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION];

  const immutableFieldsAnnotation =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_IMMUTABLE_FIELDS_ANNOTATION];

  if (loading || !allowed) {
    return null;
  }

  if (
    !entityScaffolderConfigAnnotationValue ||
    !entityScaffolderTemplateAnnotationValue
  ) {
    return (
      <MissingAnnotationEmptyState
        annotation={ENTITY_SCAFFOLDER_CONFIG_ANNOTATION}
      />
    );
  }

  const immutableFields = immutableFieldsAnnotation
    ? immutableFieldsAnnotation.split(',').map(f => f.trim()).filter(Boolean)
    : [];

  const uiSchema = immutableFields.reduce(
    (acc, field) => ({
      ...acc,
      [field]: { 'ui:readonly': true, 'ui:disabled': true },
    }),
    {} as Record<string, unknown>,
  );

  const parsedConfig = safeParseConfig(entityScaffolderConfigAnnotationValue);
  const initialState: Record<string, JsonValue> = {
    ...parsedConfig,
    firstRun: false,
    __originalFormValues: parsedConfig,
  };

  const templateEntity = parseEntityRef(entityScaffolderTemplateAnnotationValue);

  return (
    <SecretsContextProvider>
      <EmbeddedScaffolderWorkflow
        namespace={templateEntity.namespace}
        templateName={templateEntity.name}
        initialState={initialState}
        formProps={{ uiSchema }}
        onError={(error: Error | undefined) => (
          <h2>{error?.message ?? 'Error running workflow'}</h2>
        )}
      >
        <ScaffolderFieldExtensions>
          <RepoUrlPickerFieldExtension />
          <EntityPickerFieldExtension />
          <SelectFieldFromApiExtension />
          <EntityNamePickerFieldExtension />
          <MultiEntityPickerFieldExtension />
          <OwnerPickerFieldExtension />
          <MyGroupsPickerFieldExtension />
          <OwnedEntityPickerFieldExtension />
          <EntityTagsPickerFieldExtension />
          <RepoBranchPickerFieldExtension />
          <ScaffolderFieldValidatorExtension />
        </ScaffolderFieldExtensions>
      </EmbeddedScaffolderWorkflow>
    </SecretsContextProvider>
  );
};
