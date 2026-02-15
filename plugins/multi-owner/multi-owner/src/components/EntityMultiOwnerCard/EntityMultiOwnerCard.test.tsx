import { screen } from '@testing-library/react';
import { EntityMultiOwnerCard } from './EntityMultiOwnerCard';
import { EntityProvider, entityRouteRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { renderInTestApp } from '@backstage/test-utils';

// Helper to wrap component with required providers
async function renderWithEntity(entity: Entity) {
    return renderInTestApp(
        <EntityProvider entity={entity}>
            <EntityMultiOwnerCard />
        </EntityProvider>,
        {
            mountedRoutes: {
                '/catalog/:namespace/:kind/:name': entityRouteRef,
            },
        },
    );
}

describe('EntityMultiOwnerCard', () => {
    it('renders the card title', async () => {
        const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
                name: 'test',
                annotations: {
                    'backstage.io/owners': JSON.stringify([
                        { name: 'group:default/team-a', role: 'maintainer' },
                    ]),
                },
            },
        };

        await renderWithEntity(entity);
        expect(screen.getByText('Owners')).toBeInTheDocument();
    });

    it('renders "No owners defined" when no owners are present', async () => {
        const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: { name: 'test' },
        };

        await renderWithEntity(entity);
        expect(screen.getByText('No owners defined')).toBeInTheDocument();
    });

    it('renders owners with role chips', async () => {
        const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
                name: 'test',
                annotations: {
                    'backstage.io/owners': JSON.stringify([
                        { name: 'group:default/platform-team', role: 'maintainer' },
                        { name: 'user:default/jane', role: 'tech-lead' },
                    ]),
                },
            },
        };

        await renderWithEntity(entity);
        expect(screen.getByText('maintainer')).toBeInTheDocument();
        expect(screen.getByText('tech-lead')).toBeInTheDocument();
    });

    it('renders owners without roles', async () => {
        const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
                name: 'test',
                annotations: {
                    'backstage.io/owners': JSON.stringify([
                        { name: 'group:default/platform-team' },
                    ]),
                },
            },
        };

        await renderWithEntity(entity);
        expect(screen.getByText('Owners')).toBeInTheDocument();
    });

    it('renders custom title', async () => {
        const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
                name: 'test',
                annotations: {
                    'backstage.io/owners': JSON.stringify([
                        { name: 'group:default/team' },
                    ]),
                },
            },
        };

        await renderInTestApp(
            <EntityProvider entity={entity}>
                <EntityMultiOwnerCard title="Team Ownership" />
            </EntityProvider>,
            {
                mountedRoutes: {
                    '/catalog/:namespace/:kind/:name': entityRouteRef,
                },
            },
        );
        expect(screen.getByText('Team Ownership')).toBeInTheDocument();
    });

    it('falls back to spec.owner when annotation is absent', async () => {
        const entity: Entity = {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: { name: 'test' },
            spec: { owner: 'group:default/fallback-team' },
        };

        await renderWithEntity(entity);
        expect(screen.getByText('Owners')).toBeInTheDocument();
        expect(screen.queryByText('No owners defined')).not.toBeInTheDocument();
    });
});
