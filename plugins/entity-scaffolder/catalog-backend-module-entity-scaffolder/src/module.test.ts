import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { Entity } from '@backstage/catalog-model';
import { catalogServiceMock } from '@backstage/plugin-catalog-node/testUtils';
import {
  RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
  entityScaffolderEditPermission,
} from '@thecodingsheikh/backstage-plugin-entity-scaffolder-common';
import catalogModuleEntityScaffolder from './module';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'svc',
    namespace: 'default',
    annotations: { 'backstage.io/scaffolder-edit-roles': 'admin' },
  },
  spec: { owners: [{ name: 'group:default/platform', role: 'admin' }] },
};

async function startWithMocks() {
  const permissionsRegistry = mockServices.permissionsRegistry.mock();
  await startTestBackend({
    features: [
      catalogModuleEntityScaffolder,
      permissionsRegistry.factory,
      catalogServiceMock.factory({ entities: [entity] }),
    ],
  });
  expect(permissionsRegistry.addResourceType).toHaveBeenCalledTimes(1);
  return permissionsRegistry.addResourceType.mock.calls[0][0];
}

describe('catalogModuleEntityScaffolder', () => {
  it('registers the resource type against the catalog plugin', async () => {
    const options = await startWithMocks();
    expect(options.resourceRef.pluginId).toBe('catalog');
    expect(options.resourceRef.resourceType).toBe(
      RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY,
    );
  });

  it('exposes entity-scaffolder.edit so a conditional policy can select it', async () => {
    const options = await startWithMocks();
    expect(options.permissions).toEqual([entityScaffolderEditPermission]);

    // The whole point of the dedicated resource type: within this plugin's
    // metadata exactly one permission matches (resourceType, action), so the
    // action -> permission-name lookup done by policy providers is
    // unambiguous.
    const matches = options.permissions!.filter(
      p =>
        (p as { resourceType?: string }).resourceType ===
          RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY &&
        p.attributes.action === 'update',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('entity-scaffolder.edit');
  });

  it('registers the rules a conditional policy can use', async () => {
    const options = await startWithMocks();
    const names = options.rules.map(r => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'HAS_ANNOTATION',
        'IS_ENTITY_OWNER',
        'IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE',
      ]),
    );
    for (const rule of options.rules) {
      expect(rule.resourceType).toBe(RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY);
    }
  });

  it('resolves catalog entities so conditions can be evaluated', async () => {
    const options = await startWithMocks();
    const resolved = (await options.getResources!([
      'component:default/svc',
    ])) as (Entity | undefined)[];
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.metadata.name).toBe('svc');
  });

  it('returns undefined for refs that are not in the catalog', async () => {
    const options = await startWithMocks();
    const resolved = await options.getResources!(['component:default/missing']);
    expect(resolved).toEqual([undefined]);
  });
});
