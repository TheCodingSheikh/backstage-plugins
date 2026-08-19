import { Entity } from '@backstage/catalog-model';
import { permissionRules as catalogPermissionRules } from '@backstage/plugin-catalog-backend/alpha';
import { EntitiesSearchFilter } from '@backstage/plugin-catalog-node';
import { PermissionRuleParams } from '@backstage/plugin-permission-common';
import { PermissionRule } from '@backstage/plugin-permission-node';
import {
  isEntityMultiOwnerWithAnnotationRole as catalogIsEntityMultiOwnerWithAnnotationRole,
  isEntityMultiOwnerWithRole as catalogIsEntityMultiOwnerWithRole,
} from '@thecodingsheikh/backstage-plugin-catalog-backend-module-multi-owner-processor';
import { RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY } from '@thecodingsheikh/backstage-plugin-entity-scaffolder-common';

type EntityScaffolderResourceType =
  typeof RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY;

/**
 * A permission rule that operates on catalog entities under the
 * `entity-scaffolder-entity` resource type.
 *
 * @public
 */
export type EntityScaffolderPermissionRule<
  TParams extends PermissionRuleParams = PermissionRuleParams,
> = PermissionRule<
  Entity,
  EntitiesSearchFilter,
  EntityScaffolderResourceType,
  TParams
>;

/**
 * Re-binds a `catalog-entity` rule to the `entity-scaffolder-entity` resource
 * type.
 *
 * @remarks
 * Rules are registered per resource type, so the catalog's own rules are not
 * reachable from a policy written against `entity-scaffolder-entity`. Both
 * types resolve to the same `Entity` resource and the same
 * `EntitiesSearchFilter` query, so `apply`, `toQuery` and `paramsSchema` are
 * reused verbatim and only the `resourceType` discriminator changes. Sharing
 * the implementation keeps the semantics of `IS_ENTITY_OWNER` and friends
 * identical in both places.
 */
function rebind<TParams extends PermissionRuleParams>(
  rule: PermissionRule<Entity, EntitiesSearchFilter, 'catalog-entity', TParams>,
): EntityScaffolderPermissionRule<TParams> {
  return { ...rule, resourceType: RESOURCE_TYPE_ENTITY_SCAFFOLDER_ENTITY };
}

/** The catalog's `HAS_ANNOTATION` rule, for `entity-scaffolder-entity`. */
export const hasAnnotation = rebind(catalogPermissionRules.hasAnnotation);
/** The catalog's `HAS_LABEL` rule, for `entity-scaffolder-entity`. */
export const hasLabel = rebind(catalogPermissionRules.hasLabel);
/** The catalog's `HAS_METADATA` rule, for `entity-scaffolder-entity`. */
export const hasMetadata = rebind(catalogPermissionRules.hasMetadata);
/** The catalog's `HAS_SPEC` rule, for `entity-scaffolder-entity`. */
export const hasSpec = rebind(catalogPermissionRules.hasSpec);
/** The catalog's `IS_ENTITY_KIND` rule, for `entity-scaffolder-entity`. */
export const isEntityKind = rebind(catalogPermissionRules.isEntityKind);
/** The catalog's `IS_ENTITY_OWNER` rule, for `entity-scaffolder-entity`. */
export const isEntityOwner = rebind(catalogPermissionRules.isEntityOwner);
/** The multi-owner `IS_ENTITY_MULTI_OWNER_WITH_ROLE` rule. */
export const isEntityMultiOwnerWithRole = rebind(
  catalogIsEntityMultiOwnerWithRole,
);
/** The multi-owner `IS_ENTITY_MULTI_OWNER_WITH_ANNOTATION_ROLE` rule. */
export const isEntityMultiOwnerWithAnnotationRole = rebind(
  catalogIsEntityMultiOwnerWithAnnotationRole,
);

/**
 * Every rule available to conditional policies written against the
 * `entity-scaffolder-entity` resource type.
 */
export const entityScaffolderPermissionRules = [
  hasAnnotation,
  hasLabel,
  hasMetadata,
  hasSpec,
  isEntityKind,
  isEntityOwner,
  isEntityMultiOwnerWithRole,
  isEntityMultiOwnerWithAnnotationRole,
] as EntityScaffolderPermissionRule<any>[];
