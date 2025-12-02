/*
 * Copyright SeatGeek
 * Licensed under the terms of the Apache-2.0 license. See LICENSE file in project root for terms.
 */
import { parseEntityRef } from '@backstage/catalog-model';
import { 
  MissingAnnotationEmptyState,
  useEntity 
} from '@backstage/plugin-catalog-react';
import {
  SecretsContextProvider,
} from '@backstage/plugin-scaffolder-react';
import { EmbeddedScaffolderWorkflow } from '@frontside/backstage-plugin-scaffolder-workflow';

import { 
  ENTITY_SCAFFOLDER_CONFIG_ANNOTATION, 
  ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION 
} from '../../annotations';

/**
 * Use templates from within the EntityPage.
 *
 * @public
 */
export const EntityScaffolderContent = () => {
  const { entity } = useEntity();

  const entityScaffolderConfigAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_CONFIG_ANNOTATION];

  const entityScaffolderTemplateAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION];

  const initialState = {
    ...(entityScaffolderConfigAnnotationValue
      ? JSON.parse(entityScaffolderConfigAnnotationValue)
      : {}),
    firstRun: false,
  };

  if (
    entityScaffolderConfigAnnotationValue && entityScaffolderTemplateAnnotationValue
  ) {
    const templateEntity = parseEntityRef(entityScaffolderTemplateAnnotationValue);

    return (
      <SecretsContextProvider>
        <EmbeddedScaffolderWorkflow
          namespace={templateEntity.namespace}
          templateName={templateEntity.name}
          initialState={initialState}
          onError={(error: Error | undefined) => (
            <h2>{error?.message ?? 'Error running workflow'}</h2>
          )}
        >
        </EmbeddedScaffolderWorkflow>
      </SecretsContextProvider>
    );
  }
  return (
    <MissingAnnotationEmptyState annotation={ENTITY_SCAFFOLDER_CONFIG_ANNOTATION} />
      
  );
};