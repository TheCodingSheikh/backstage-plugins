/**
 * Frontend plugin that provides the EntityMultiOwnerCard for displaying
 * multiple owners on entity pages.
 *
 * @remarks
 * - Legacy app-defaults consumers use the named exports below.
 * - New Frontend System consumers should import the default export from
 *   `@thecodingsheikh/backstage-plugin-multi-owner/alpha`.
 *
 * @packageDocumentation
 */

export {
  multiOwnerPlugin,
  EntityMultiOwnerCard,
  isMultiOwnerAvailable,
} from './plugin';
export { useMultiOwners } from './hooks/useMultiOwners';
