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
