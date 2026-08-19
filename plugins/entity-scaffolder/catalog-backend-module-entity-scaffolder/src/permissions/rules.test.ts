import { Entity } from '@backstage/catalog-model';
import { RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY } from '@thecodingsheikh/backstage-plugin-entity-scaffolder-common';
import {
  entityScaffolderPermissionRules,
  hasAnnotation,
  isEntityMultiOwnerWithAnnotationRole,
  isEntityOwner,
} from './rules';

function makeEntity(params: {
  annotations?: Record<string, string>;
  owners?: unknown;
}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'svc', annotations: params.annotations },
    spec: params.owners !== undefined ? { owners: params.owners } : {},
  };
}

describe('entity-scaffolder permission rules', () => {
  it('binds every rule to the entity-scaffolder resource type', () => {
    expect(entityScaffolderPermissionRules.length).toBeGreaterThan(0);
    for (const rule of entityScaffolderPermissionRules) {
      expect(rule.resourceType).toBe(RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY);
    }
  });

  it('exposes the catalog rules under their original names', () => {
    const names = entityScaffolderPermissionRules.map(r => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'HAS_ANNOTATION',
        'IS_ENTITY_OWNER',
        'IS_ENTITY_MULTI_OWNER_WITH_ROLE',
        'IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE',
      ]),
    );
  });

  it('does not leak the catalog-entity resource type into rule names', () => {
    // A stale `catalog-entity` binding here is exactly what makes a conditional
    // policy silently never match, so assert it explicitly.
    expect(
      entityScaffolderPermissionRules.some(
        r => (r.resourceType as string) === 'catalog-entity',
      ),
    ).toBe(false);
  });

  it('preserves HAS_ANNOTATION behaviour after re-binding', () => {
    const annotated = makeEntity({
      annotations: { 'backstage.io/scaffolder-edit-roles': 'admin' },
    });
    expect(
      hasAnnotation.apply(annotated, {
        annotation: 'backstage.io/scaffolder-edit-roles',
      }),
    ).toBe(true);
    expect(
      hasAnnotation.apply(makeEntity({}), {
        annotation: 'backstage.io/scaffolder-edit-roles',
      }),
    ).toBe(false);
  });

  it('preserves IS_ENTITY_OWNER behaviour after re-binding', () => {
    const entity: Entity = {
      ...makeEntity({}),
      relations: [{ type: 'ownedBy', targetRef: 'group:default/team-a' }],
    };
    expect(
      isEntityOwner.apply(entity, { claims: ['group:default/team-a'] }),
    ).toBe(true);
    expect(
      isEntityOwner.apply(entity, { claims: ['group:default/other'] }),
    ).toBe(false);
  });

  it('preserves the multi-owner annotation-role behaviour after re-binding', () => {
    const entity = makeEntity({
      annotations: { 'backstage.io/scaffolder-edit-roles': 'admin' },
      owners: [
        { name: 'group:default/team', role: 'edit' },
        { name: 'group:default/platform', role: 'admin' },
      ],
    });

    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/platform'],
        annotation: 'backstage.io/scaffolder-edit-roles',
      }),
    ).toBe(true);

    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/team'],
        annotation: 'backstage.io/scaffolder-edit-roles',
      }),
    ).toBe(false);
  });
});
