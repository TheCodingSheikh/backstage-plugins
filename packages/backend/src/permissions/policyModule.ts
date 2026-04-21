import { createBackendModule } from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { ScaffolderRbacPolicy } from './ScaffolderRbacPolicy';

/**
 * Backend module that installs {@link ScaffolderRbacPolicy} as the
 * permission policy for this app.
 */
export default createBackendModule({
  pluginId: 'permission',
  moduleId: 'scaffolder-rbac-policy',
  register(reg) {
    reg.registerInit({
      deps: { policy: policyExtensionPoint },
      async init({ policy }) {
        policy.setPolicy(new ScaffolderRbacPolicy());
      },
    });
  },
});
