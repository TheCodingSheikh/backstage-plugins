import { createDevApp } from '@backstage/dev-utils';
import { entityScaffolderPlugin, EntityScaffolderContent } from '../src/plugin';

createDevApp()
  .registerPlugin(entityScaffolderPlugin)
  .addPage({
    element: <EntityScaffolderContent />,
    title: 'Root Page',
    path: '/entity-scaffolder',
  })
  .render();
