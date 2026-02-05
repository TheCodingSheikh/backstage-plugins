import { createDevApp } from '@backstage/dev-utils';
import { scaffolderFieldValidatorPlugin, ScaffolderFieldValidatorPage } from '../src/plugin';

createDevApp()
  .registerPlugin(scaffolderFieldValidatorPlugin)
  .addPage({
    element: <ScaffolderFieldValidatorPage />,
    title: 'Root Page',
    path: '/scaffolder-field-validator',
  })
  .render();
