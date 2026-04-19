import { screen } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { renderInTestApp } from '@backstage/test-utils';
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

describe('EntityScaffolderContent', () => {
  it('renders MissingAnnotationEmptyState when required annotations are absent', async () => {
    const entity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
    };

    await renderInTestApp(
      <EntityProvider entity={entity}>
        <EntityScaffolderContent />
      </EntityProvider>,
    );

    expect(
      screen.getAllByText(new RegExp(ENTITY_SCAFFOLDER_CONFIG_ANNOTATION)).length,
    ).toBeGreaterThan(0);
  });

  it('renders the embedded scaffolder workflow when annotations are present', async () => {
    const entity: Entity = {
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

    await renderInTestApp(
      <EntityProvider entity={entity}>
        <EntityScaffolderContent />
      </EntityProvider>,
    );

    expect(
      screen.getByTestId('embedded-scaffolder-workflow'),
    ).toHaveTextContent('template:my-template');
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

    await renderInTestApp(
      <EntityProvider entity={entity}>
        <EntityScaffolderContent />
      </EntityProvider>,
    );

    expect(
      screen.getByTestId('embedded-scaffolder-workflow'),
    ).toBeInTheDocument();
  });
});
