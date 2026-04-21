import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const entityScaffolderPlugin = createPlugin({
  id: 'entity-scaffolder',
  routes: {
    root: rootRouteRef,
  },
});

export const EntityScaffolderContent = entityScaffolderPlugin.provide(
  createRoutableExtension({
    name: 'EntityScaffolderContent',
    component: () =>
      import('./components/EntityScaffolderContent').then(m => m.EntityScaffolderContent),
    mountPoint: rootRouteRef,
  }),
);
