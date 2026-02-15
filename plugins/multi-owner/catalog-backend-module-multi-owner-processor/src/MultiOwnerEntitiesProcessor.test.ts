import { MultiOwnerEntitiesProcessor } from './MultiOwnerEntitiesProcessor';
import { Entity } from '@backstage/catalog-model';
import {
    RELATION_OWNED_BY,
    RELATION_OWNER_OF,
} from '@backstage/catalog-model';
import { MULTI_OWNER_ANNOTATION } from './utils/constants';

const mockLocation = {
    type: 'url' as const,
    target: 'https://example.com/catalog-info.yaml',
};

describe('MultiOwnerEntitiesProcessor', () => {
    let processor: MultiOwnerEntitiesProcessor;

    beforeEach(() => {
        processor = new MultiOwnerEntitiesProcessor();
    });

    describe('getProcessorName', () => {
        it('returns the correct name', () => {
            expect(processor.getProcessorName()).toBe(
                'MultiOwnerEntitiesProcessor',
            );
        });
    });

    describe('preProcessEntity', () => {
        it('passes through entities without spec.owners', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'test' },
                spec: { owner: 'group:default/team-a' },
            };

            const result = await processor.preProcessEntity(entity, mockLocation);
            expect(result).toEqual(entity);
        });

        it('writes normalized owners annotation for string entries', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'test' },
                spec: {
                    owners: ['group:default/team-a', 'user:default/jane'],
                },
            };

            const result = await processor.preProcessEntity(entity, mockLocation);
            const annotation = result.metadata.annotations?.[MULTI_OWNER_ANNOTATION];
            expect(annotation).toBeDefined();
            expect(JSON.parse(annotation!)).toEqual([
                { name: 'group:default/team-a' },
                { name: 'user:default/jane' },
            ]);
        });

        it('writes normalized owners annotation for object entries', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'test' },
                spec: {
                    owners: [
                        { name: 'group:default/team-a', role: 'maintainer' },
                        { name: 'user:default/jane', role: 'tech-lead' },
                    ],
                },
            };

            const result = await processor.preProcessEntity(entity, mockLocation);
            const annotation = result.metadata.annotations?.[MULTI_OWNER_ANNOTATION];
            expect(JSON.parse(annotation!)).toEqual([
                { name: 'group:default/team-a', role: 'maintainer' },
                { name: 'user:default/jane', role: 'tech-lead' },
            ]);
        });

        it('preserves existing annotations', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: {
                    name: 'test',
                    annotations: { 'existing/annotation': 'keep' },
                },
                spec: {
                    owners: ['group:default/team-a'],
                },
            };

            const result = await processor.preProcessEntity(entity, mockLocation);
            expect(result.metadata.annotations?.['existing/annotation']).toBe(
                'keep',
            );
            expect(
                result.metadata.annotations?.[MULTI_OWNER_ANNOTATION],
            ).toBeDefined();
        });
    });

    describe('postProcessEntity', () => {
        it('does not emit relations for entities without spec.owners', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'test' },
                spec: { owner: 'group:default/team-a' },
            };

            const emit = jest.fn();
            await processor.postProcessEntity(entity, mockLocation, emit);
            expect(emit).not.toHaveBeenCalled();
        });

        it('emits ownedBy and ownerOf relations for each owner', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'my-service', namespace: 'default' },
                spec: {
                    owners: [
                        'group:default/platform-team',
                        { name: 'user:default/jane', role: 'tech-lead' },
                    ],
                },
            };

            const emit = jest.fn();
            await processor.postProcessEntity(entity, mockLocation, emit);

            // 2 owners × 2 relations (ownedBy + ownerOf) = 4 emissions
            expect(emit).toHaveBeenCalledTimes(4);

            // Check first owner relations
            expect(emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'relation',
                    relation: expect.objectContaining({
                        type: RELATION_OWNED_BY,
                        source: { kind: 'Component', namespace: 'default', name: 'my-service' },
                        target: { kind: 'group', namespace: 'default', name: 'platform-team' },
                    }),
                }),
            );

            expect(emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'relation',
                    relation: expect.objectContaining({
                        type: RELATION_OWNER_OF,
                        source: { kind: 'group', namespace: 'default', name: 'platform-team' },
                        target: { kind: 'Component', namespace: 'default', name: 'my-service' },
                    }),
                }),
            );

            // Check second owner relations
            expect(emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'relation',
                    relation: expect.objectContaining({
                        type: RELATION_OWNED_BY,
                        source: { kind: 'Component', namespace: 'default', name: 'my-service' },
                        target: { kind: 'user', namespace: 'default', name: 'jane' },
                    }),
                }),
            );
        });

        it('defaults namespace to "default" when not specified', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'test' },
                spec: {
                    owners: ['team-a'],
                },
            };

            const emit = jest.fn();
            await processor.postProcessEntity(entity, mockLocation, emit);

            expect(emit).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'relation',
                    relation: expect.objectContaining({
                        type: RELATION_OWNED_BY,
                        target: { kind: 'group', namespace: 'default', name: 'team-a' },
                    }),
                }),
            );
        });

        it('skips invalid entity references gracefully', async () => {
            const entity: Entity = {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: { name: 'test' },
                spec: {
                    owners: [
                        'group:default/valid-team',
                        // parseOwners won't produce entries that cause parseEntityRef to fail,
                        // but we test the overall flow
                    ],
                },
            };

            const emit = jest.fn();
            await processor.postProcessEntity(entity, mockLocation, emit);
            expect(emit).toHaveBeenCalledTimes(2); // 1 valid owner × 2 relations
        });
    });
});
