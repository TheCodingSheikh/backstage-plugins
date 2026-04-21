import { Entity } from '@backstage/catalog-model';
import { canEditEntity, getAllowedEditRoles } from './canEditEntity';
import { ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION } from '../annotations';

function makeEntity(params: {
  annotations?: Record<string, string>;
  owners?: unknown;
}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'test', annotations: params.annotations },
    spec: params.owners !== undefined ? { owners: params.owners } : {},
  };
}

describe('getAllowedEditRoles', () => {
  it('returns undefined when the annotation is missing', () => {
    expect(getAllowedEditRoles(makeEntity({}))).toBeUndefined();
  });

  it('returns undefined when the annotation is empty', () => {
    expect(
      getAllowedEditRoles(
        makeEntity({ annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: '  ,  ' } }),
      ),
    ).toBeUndefined();
  });

  it('parses a comma-separated list trimming whitespace', () => {
    expect(
      getAllowedEditRoles(
        makeEntity({
          annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: ' edit , admin ' },
        }),
      ),
    ).toEqual(['edit', 'admin']);
  });
});

describe('canEditEntity', () => {
  it('allows anyone when the annotation is absent (fallback)', () => {
    const entity = makeEntity({ owners: [{ name: 'group:default/team', role: 'edit' }] });
    expect(canEditEntity(entity, [])).toBe(true);
  });

  it('allows an owner whose role matches the allowlist', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit' },
      owners: [
        { name: 'group:default/team-a', role: 'edit' },
        { name: 'group:default/team-b', role: 'viewer' },
      ],
    });
    expect(canEditEntity(entity, ['group:default/team-a'])).toBe(true);
  });

  it('denies an owner whose role is not in the allowlist', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'admin' },
      owners: [{ name: 'group:default/team-a', role: 'edit' }],
    });
    expect(canEditEntity(entity, ['group:default/team-a'])).toBe(false);
  });

  it('denies a user who is not among the entity owners', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit' },
      owners: [{ name: 'group:default/team-a', role: 'edit' }],
    });
    expect(canEditEntity(entity, ['group:default/other'])).toBe(false);
  });

  it('denies shorthand owners (no role) when the annotation is set', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit' },
      owners: ['group:default/team-a'],
    });
    expect(canEditEntity(entity, ['group:default/team-a'])).toBe(false);
  });

  it('normalizes entity refs so shorthand matches fully-qualified', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit' },
      owners: [{ name: 'team-a', role: 'edit' }],
    });
    expect(canEditEntity(entity, ['group:default/team-a'])).toBe(true);
  });

  it('is case-insensitive on entity ref matching', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit' },
      owners: [{ name: 'Group:default/Team-A', role: 'edit' }],
    });
    expect(canEditEntity(entity, ['group:default/team-a'])).toBe(true);
  });

  it('allows admin when the annotation lists multiple roles', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit,admin' },
      owners: [{ name: 'group:default/platform', role: 'admin' }],
    });
    expect(canEditEntity(entity, ['group:default/platform'])).toBe(true);
  });

  it('denies when the entity has no owners and the annotation is set', () => {
    const entity = makeEntity({
      annotations: { [ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION]: 'edit' },
    });
    expect(canEditEntity(entity, ['group:default/team-a'])).toBe(false);
  });
});
