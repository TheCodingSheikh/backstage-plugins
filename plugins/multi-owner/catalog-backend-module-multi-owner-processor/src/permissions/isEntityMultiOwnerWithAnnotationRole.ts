import { Entity } from '@backstage/catalog-model';
import { EntitiesSearchFilter } from '@backstage/plugin-catalog-node';
import { PermissionRule } from '@backstage/plugin-permission-node';
import { hasMultiOwnerWithRole, parseRolesAnnotation } from './util';

type Params = { claims: string[]; annotation: string };

/**
 * A catalog permission rule like {@link isEntityMultiOwnerWithRole}, but
 * reads the allowlist of roles from a per-entity annotation instead of
 * accepting them as a static policy parameter.
 *
 * @remarks
 * Lets admins drive per-entity role requirements from entity YAML, e.g.
 * `backstage.io/scaffolder-edit-roles: 'admin'`. The rule returns `false`
 * when the annotation is absent — compose with `HAS_ANNOTATION` / `not`
 * in a policy if you want an "annotation missing ⇒ fall back to owner"
 * branch.
 */
export const isEntityMultiOwnerWithAnnotationRole: PermissionRule<
  Entity,
  EntitiesSearchFilter,
  'catalog-entity',
  Params
> = {
  name: 'IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE',
  description:
    'Allow entities where the subject appears in spec.owners with a role listed in the given entity annotation (comma-separated).',
  resourceType: 'catalog-entity',
  apply: (resource, { claims, annotation }) => {
    const roles = parseRolesAnnotation(resource, annotation);
    if (!roles) return false;
    return hasMultiOwnerWithRole(resource, claims, roles);
  },
  toQuery: ({ claims, annotation }) => ({
    allOf: [
      { key: 'relations.ownedBy', values: claims },
      { key: `metadata.annotations.${annotation}` },
    ],
  }),
};
