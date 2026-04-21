import { screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { renderInTestApp, TestApiProvider } from '@backstage/test-utils';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { EntityScaffolderContent } from './EntityScaffolderContent';
import {
  ENTITY_SCAFFOLDER_CONFIG_ANNOTATION,
  ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION,
} from '../../annotations';

jest.mock('@frontside/backstage-plugin-scaffolder-workflow', () => ({
  EmbeddedScaffolderWorkflow: ({ templateName }: { templateName: string }) => (
    <div data-testid="embedded-scaffolder-workflow">template:{templateName}</div>
  ),
}));

jest.mock('@backstage/plugin-scaffolder', () => ({
  EntityPickerFieldExtension: () => null,
  RepoUrlPickerFieldExtension: () => null,
  EntityNamePickerFieldExtension: () => null,
  MultiEntityPickerFieldExtension: () => null,
  OwnerPickerFieldExtension: () => null,
  MyGroupsPickerFieldExtension: () => null,
  OwnedEntityPickerFieldExtension: () => null,
  EntityTagsPickerFieldExtension: () => null,
  RepoBranchPickerFieldExtension: () => null,
}));

jest.mock('@roadiehq/plugin-scaffolder-frontend-module-http-request-field', () => ({
  SelectFieldFromApiExtension: () => null,
}));

const mockPermissionApi = (result: AuthorizeResult.ALLOW | AuthorizeResult.DENY) => ({
  authorize: jest.fn(async () => ({ result } as const)),
  authorizeConditional: jest.fn(async () => ({ result } as const)),
});

const renderWithPermission = (
  entity: Entity,
  result: AuthorizeResult.ALLOW | AuthorizeResult.DENY,
) =>
  renderInTestApp(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <TestApiProvider apis={[[permissionApiRef, mockPermissionApi(result)]]}>
        <EntityProvider entity={entity}>
          <EntityScaffolderContent />
        </EntityProvider>
      </TestApiProvider>
    </SWRConfig>,
  );

describe('EntityScaffolderContent', () => {
  const entityWithAnnotations: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'test',
      annotations: {
        [ENTITY_SCAFFOLDER_CONFIG_ANNOTATION]: JSON.stringify({ foo: 'bar' }),
        [ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION]: 'template:default/my-template',
      },
    },
  };

  it('renders MissingAnnotationEmptyState when required annotations are absent and user is allowed', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
    };

    await renderWithPermission(entity, AuthorizeResult.ALLOW);

    expect(
      (await screen.findAllByText(new RegExp(ENTITY_SCAFFOLDER_CONFIG_ANNOTATION))).length,
    ).toBeGreaterThan(0);
  });

  it('renders the embedded scaffolder workflow when annotations are present and user is allowed', async () => {
    await renderWithPermission(entityWithAnnotations, AuthorizeResult.ALLOW);

    expect(
      await screen.findByTestId('embedded-scaffolder-workflow'),
    ).toHaveTextContent('template:my-template');
  });

  it('renders a "not authorized" WarningPanel when the user is denied', async () => {
    await renderWithPermission(entityWithAnnotations, AuthorizeResult.DENY);

    expect(
      await screen.findByText(/info:\s*not authorized/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/do not have permission to edit this entity/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('embedded-scaffolder-workflow')).not.toBeInTheDocument();
  });

  it('tolerates malformed config annotation JSON without throwing', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'test',
        annotations: {
          [ENTITY_SCAFFOLDER_CONFIG_ANNOTATION]: '{not valid json',
          [ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION]: 'template:default/my-template',
        },
      },
    };

    await renderWithPermission(entity, AuthorizeResult.ALLOW);

    expect(await screen.findByTestId('embedded-scaffolder-workflow')).toBeInTheDocument();
  });
});
