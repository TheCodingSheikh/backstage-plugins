/**
 * Catalog backend module that registers the `entity-scaffolder-entity`
 * permission resource type, so conditional policies can be scoped to the
 * `entity-scaffolder.edit` permission.
 *
 * @packageDocumentation
 */
export { default } from './module';
export {
  entityScaffolderPermissionResourceRef,
  entityScaffolderPermissionRules,
  hasAnnotation,
  hasLabel,
  hasMetadata,
  hasSpec,
  isEntityKind,
  isEntityMultiOwnerWithAnnotationRole,
  isEntityMultiOwnerWithRole,
  isEntityOwner,
} from './permissions';
export type { EntityScaffolderPermissionRule } from './permissions';
