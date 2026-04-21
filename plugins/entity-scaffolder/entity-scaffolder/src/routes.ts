import { createRouteRef } from '@backstage/core-plugin-api';

/**
 * Route reference used by the entity-scaffolder entity-content extension.
 *
 * @remarks
 * Kept in `src/routes.ts` to avoid circular imports between `plugin.ts`
 * and component files.
 */
export const rootRouteRef = createRouteRef({
  id: 'entity-scaffolder',
});
