import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { multiOwnerPlugin, EntityMultiOwnerCard } from '../src/plugin';

const mockEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
        name: 'example-service',
        namespace: 'default',
        annotations: {
            'backstage.io/owners': JSON.stringify([
                { name: 'group:default/platform-team', role: 'maintainer' },
                { name: 'group:default/sre-team', role: 'operations' },
                { name: 'user:default/jane.doe', role: 'tech-lead' },
                { name: 'group:default/qa-team' },
            ]),
        },
    },
    spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'group:default/platform-team',
    },
};

createDevApp()
    .registerPlugin(multiOwnerPlugin)
    .addPage({
        element: (
            <EntityProvider entity={mockEntity}>
                <div style={{ maxWidth: 400, margin: '40px auto' }}>
                    <EntityMultiOwnerCard />
                </div>
            </EntityProvider>
        ),
        title: 'Multi-Owner Card',
        path: '/multi-owner',
    })
    .render();
