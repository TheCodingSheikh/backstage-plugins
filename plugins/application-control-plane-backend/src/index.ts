import { coreServices, createBackendPlugin } from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';

export const applicationControlPlanePlugin = createBackendPlugin({
  pluginId: 'application-control-plane',
  register(env) {
    env.registerInit({
      deps: {
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        userInfo: coreServices.userInfo,
        catalog: catalogServiceRef,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ auth, httpAuth, userInfo, catalog, httpRouter, logger, config }) {
        httpRouter.use(await createRouter({ auth, httpAuth, userInfo, catalog, logger, config }));
      },
    });
  },
});

export default applicationControlPlanePlugin;
