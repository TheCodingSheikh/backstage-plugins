import {
  createFrontendPlugin,
  FrontendPlugin,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { isEntityScaffolderAvailable } from './utils/isEntityScaffolderAvailable';

/**
 * New Frontend System entry point.
 *
 * @remarks
 * Apps using `@backstage/frontend-defaults` should install this default
 * export. Contributes an `EntityContentBlueprint` that mounts at the
 * `/entity-scaffolder` tab on entity pages, visible only when the
 * required annotations are present.
 */
const entityScaffolderContent = EntityContentBlueprint.make({
  name: 'entity-scaffolder',
  params: {
    path: 'entity-scaffolder',
    title: 'Scaffolder',
    filter: isEntityScaffolderAvailable,
    loader: () =>
      import('./components/EntityScaffolderContent').then(m => (
        <m.EntityScaffolderContent />
      )),
  },
});

const plugin: FrontendPlugin = createFrontendPlugin({
  pluginId: 'entity-scaffolder',
  extensions: [entityScaffolderContent],
});

export default plugin;
