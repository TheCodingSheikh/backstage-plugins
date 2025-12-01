/*
 * Copyright SeatGeek
 * Licensed under the terms of the Apache-2.0 license. See LICENSE file in project root for terms.
 */
import { Entity } from '@backstage/catalog-model';
import { 
  MissingAnnotationEmptyState,
  useEntity 
} from '@backstage/plugin-catalog-react';
import { TemplateEntityV1beta3 } from '@backstage/plugin-scaffolder-common';
import {
  SecretsContextProvider,
} from '@backstage/plugin-scaffolder-react';
import type { JsonValue } from '@backstage/types';
import { EmbeddedScaffolderWorkflow } from '@frontside/backstage-plugin-scaffolder-workflow';
import React from 'react';

import { ENTITY_SCAFFOLDER_ANNOTATION } from '../../annotations';

/**
 * @public
 *
 * Props for {@link EntityScaffolderContent}
 * */
export type EntityScaffolderContentProps = {
  templateName: string;
  templateNamespace?: string;
  buildInitialState: (
    entity: Entity,
    template: TemplateEntityV1beta3
  ) => Record<string, JsonValue>;
  ScaffolderFieldExtensions?: React.ReactNode;
};

/**
 * Use templates from within the EntityPage.
 *
 * @public
 */
export const EntityScaffolderContent = ({
  templateName,
  templateNamespace = 'default',
  buildInitialState,
  ScaffolderFieldExtensions,
}: EntityScaffolderContentProps) => {
  const { entity } = useEntity();

  const entityScaffolderAnnotationValue =
    entity.metadata.annotations?.[ENTITY_SCAFFOLDER_ANNOTATION];
  
  const templateEntity = {
    apiVersion: 'scaffolder.backstage.io/v1beta3',
    kind: 'Template',
    metadata: {
      name: templateName,
      namespace: templateNamespace,
    },
    spec: {},
  } as TemplateEntityV1beta3;

  if (
    entityScaffolderAnnotationValue 
  ) {
    return (
      <SecretsContextProvider>
        <EmbeddedScaffolderWorkflow
          namespace={templateNamespace}
          templateName={templateName}
          initialState={buildInitialState(entity, templateEntity)}
          onError={(error: Error | undefined) => (
            <h2>{error?.message ?? 'Error running workflow'}</h2>
          )}
        >
          {ScaffolderFieldExtensions ?? null}
        </EmbeddedScaffolderWorkflow>
      </SecretsContextProvider>
    );
  }
  return (
    <MissingAnnotationEmptyState annotation={ENTITY_SCAFFOLDER_ANNOTATION} />
      
  );
};