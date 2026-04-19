import {
  createFrontendPlugin,
  FrontendPlugin,
} from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

/**
 * New Frontend System entry point.
 *
 * @remarks
 * Apps using `@backstage/frontend-defaults` should install this default
 * export. The plugin contributes an `EntityCardBlueprint` that renders
 * the multi-owner card on entity overview pages.
 */
const multiOwnerCard = EntityCardBlueprint.make({
  name: 'multi-owner',
  params: {
    loader: () =>
      import('./components/EntityMultiOwnerCard').then(m => (
        <m.EntityMultiOwnerCard />
      )),
  },
});

const plugin: FrontendPlugin = createFrontendPlugin({
  pluginId: 'multi-owner',
  extensions: [multiOwnerCard],
});

export default plugin;
