/**
 * Entity-scaffolder plugin.
 *
 * @remarks
 * - Legacy app-defaults consumers use the named exports below.
 * - New Frontend System consumers should import the default export from
 *   `@thecodingsheikh/backstage-plugin-entity-scaffolder/alpha`.
 *
 * @packageDocumentation
 */

export { entityScaffolderPlugin, EntityScaffolderContent } from './plugin';
export { isEntityScaffolderAvailable } from './utils/isEntityScaffolderAvailable';
export { canEditEntity, getAllowedEditRoles } from './utils/canEditEntity';
export { useCanEditEntityScaffolder } from './hooks/useCanEditEntityScaffolder';
export {
  ENTITY_SCAFFOLDER_CONFIG_ANNOTATION,
  ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION,
  ENTITY_SCAFFOLDER_IMMUTABLE_FIELDS_ANNOTATION,
  ENTITY_SCAFFOLDER_EDIT_ROLES_ANNOTATION,
} from './annotations';
