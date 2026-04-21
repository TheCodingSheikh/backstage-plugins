import { Entity } from '@backstage/catalog-model';
import { isEntityMultiOwnerWithRole } from './isEntityMultiOwnerWithRole';
import { isEntityMultiOwnerWithAnnotationRole } from './isEntityMultiOwnerWithAnnotationRole';

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

describe('isEntityMultiOwnerWithRole', () => {
  it('allows a user whose owner role is in the allowlist', () => {
    const entity = makeEntity({
      owners: [{ name: 'group:default/team-a', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithRole.apply(entity, {
        claims: ['group:default/team-a'],
        roles: ['edit'],
      }),
    ).toBe(true);
  });

  it('denies when the owner role is not in the allowlist', () => {
    const entity = makeEntity({
      owners: [{ name: 'group:default/team-a', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithRole.apply(entity, {
        claims: ['group:default/team-a'],
        roles: ['admin'],
      }),
    ).toBe(false);
  });

  it('denies when the user is not among the owners', () => {
    const entity = makeEntity({
      owners: [{ name: 'group:default/team-a', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithRole.apply(entity, {
        claims: ['group:default/other'],
        roles: ['edit'],
      }),
    ).toBe(false);
  });

  it('denies shorthand (role-less) owners', () => {
    const entity = makeEntity({ owners: ['group:default/team-a'] });
    expect(
      isEntityMultiOwnerWithRole.apply(entity, {
        claims: ['group:default/team-a'],
        roles: ['edit'],
      }),
    ).toBe(false);
  });

  it('normalises entity refs when comparing owner.name to claims', () => {
    const entity = makeEntity({
      owners: [{ name: 'team-a', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithRole.apply(entity, {
        claims: ['group:default/team-a'],
        roles: ['edit'],
      }),
    ).toBe(true);
  });

  it('accepts any role in the allowlist (multi-role policies)', () => {
    const entity = makeEntity({
      owners: [{ name: 'group:default/platform', role: 'admin' }],
    });
    expect(
      isEntityMultiOwnerWithRole.apply(entity, {
        claims: ['group:default/platform'],
        roles: ['edit', 'admin'],
      }),
    ).toBe(true);
  });

  it('produces a toQuery filter keyed on relations.ownedBy', () => {
    const filter = isEntityMultiOwnerWithRole.toQuery({
      claims: ['user:default/a', 'group:default/team'],
      roles: ['edit'],
    });
    expect(filter).toEqual({
      key: 'relations.ownedBy',
      values: ['user:default/a', 'group:default/team'],
    });
  });
});

describe('isEntityMultiOwnerWithAnnotationRole', () => {
  const ANN = 'backstage.io/scaffolder-edit-roles';

  it('allows when the annotation-listed role matches the owner', () => {
    const entity = makeEntity({
      annotations: { [ANN]: 'admin' },
      owners: [{ name: 'group:default/platform', role: 'admin' }],
    });
    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/platform'],
        annotation: ANN,
      }),
    ).toBe(true);
  });

  it('parses comma-separated role lists from the annotation', () => {
    const entity = makeEntity({
      annotations: { [ANN]: 'edit, admin' },
      owners: [{ name: 'group:default/team', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/team'],
        annotation: ANN,
      }),
    ).toBe(true);
  });

  it('denies when the annotation is absent', () => {
    const entity = makeEntity({
      owners: [{ name: 'group:default/team', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/team'],
        annotation: ANN,
      }),
    ).toBe(false);
  });

  it('denies when the annotation is present but empty', () => {
    const entity = makeEntity({
      annotations: { [ANN]: '  , ' },
      owners: [{ name: 'group:default/team', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/team'],
        annotation: ANN,
      }),
    ).toBe(false);
  });

  it("denies when the user's owner role does not match the annotation", () => {
    const entity = makeEntity({
      annotations: { [ANN]: 'admin' },
      owners: [{ name: 'group:default/team', role: 'edit' }],
    });
    expect(
      isEntityMultiOwnerWithAnnotationRole.apply(entity, {
        claims: ['group:default/team'],
        annotation: ANN,
      }),
    ).toBe(false);
  });

  it('produces a toQuery filter joining ownership and annotation presence', () => {
    const filter = isEntityMultiOwnerWithAnnotationRole.toQuery({
      claims: ['group:default/team'],
      annotation: ANN,
    });
    expect(filter).toEqual({
      allOf: [
        { key: 'relations.ownedBy', values: ['group:default/team'] },
        { key: `metadata.annotations.${ANN}` },
      ],
    });
  });
});
