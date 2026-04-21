import { Entity } from '@backstage/catalog-model';
import { EntitiesSearchFilter } from '@backstage/plugin-catalog-node';
import { PermissionRule } from '@backstage/plugin-permission-node';
import { hasMultiOwnerWithRole } from './util';

type Params = { claims: string[]; roles: string[] };

/**
 * A catalog permission rule that allows entities where the subject is listed
 * in `spec.owners` with a `role` contained in the supplied allowlist.
 *
 * @remarks
 * Unlike the built-in `IS_ENTITY_OWNER` rule, this one inspects the `role`
 * field on each entry in the multi-owner `spec.owners` array. Plain-string
 * shorthand owners (without a `role`) never match.
 *
 * The `toQuery` filter narrows to entities the user already owns (via the
 * `relations.ownedBy` index); the role refinement is applied in-memory by
 * {@link hasMultiOwnerWithRole}.
 */
export const isEntityMultiOwnerWithRole: PermissionRule<
  Entity,
  EntitiesSearchFilter,
  'catalog-entity',
  Params
> = {
  name: 'IS_ENTITY_MULTI_OWNER_WITH_ROLE',
  description:
    'Allow entities where the subject appears in spec.owners with a role from the given allowlist.',
  resourceType: 'catalog-entity',
  apply: (resource, { claims, roles }) =>
    hasMultiOwnerWithRole(resource, claims, roles),
  toQuery: ({ claims }) => ({
    key: 'relations.ownedBy',
    values: claims,
  }),
};
