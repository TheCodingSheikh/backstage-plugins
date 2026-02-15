import {
    CatalogProcessor,
    CatalogProcessorEmit,
    processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
    RELATION_OWNED_BY,
    RELATION_OWNER_OF,
    parseEntityRef,
    stringifyEntityRef,
} from '@backstage/catalog-model';
import {
    MULTI_OWNER_ANNOTATION,
    parseOwners,
} from '@thecodingsheikh/backstage-plugin-multi-owner-common';

/**
 * A catalog processor that reads `spec.owners` from entities and emits
 * `ownedBy` / `ownerOf` relations for each owner listed.
 *
 * It also writes the normalized owner list as a JSON annotation
 * (`backstage.io/owners`) so the frontend can display them.
 *
 * @remarks
 * This processor runs *in addition to* the built-in processor that handles
 * `spec.owner`. If both fields are present, owners from both are emitted.
 * Duplicate relations are automatically deduplicated by the catalog engine.
 */
export class MultiOwnerEntitiesProcessor implements CatalogProcessor {
    getProcessorName(): string {
        return 'MultiOwnerEntitiesProcessor';
    }

    async preProcessEntity(
        entity: Entity,
        _location: LocationSpec,
    ): Promise<Entity> {
        const spec = entity.spec as Record<string, unknown> | undefined;
        if (!spec?.owners) {
            return entity;
        }

        const owners = parseOwners(spec.owners);
        if (owners.length === 0) {
            return entity;
        }

        // Write the normalized owner list as a JSON annotation so the
        // frontend card can read it without re-parsing spec.
        return {
            ...entity,
            metadata: {
                ...entity.metadata,
                annotations: {
                    ...entity.metadata.annotations,
                    [MULTI_OWNER_ANNOTATION]: JSON.stringify(owners),
                },
            },
        };
    }

    async postProcessEntity(
        entity: Entity,
        _location: LocationSpec,
        emit: CatalogProcessorEmit,
    ): Promise<Entity> {
        const spec = entity.spec as Record<string, unknown> | undefined;
        if (!spec?.owners) {
            return entity;
        }

        const owners = parseOwners(spec.owners);

        for (const owner of owners) {
            let ownerRef: string;
            try {
                // Validate and normalize the entity reference
                const parsed = parseEntityRef(owner.name, {
                    defaultKind: 'group',
                    defaultNamespace: entity.metadata.namespace || 'default',
                });
                ownerRef = stringifyEntityRef(parsed);
            } catch {
                // Skip invalid references
                continue;
            }

            // Emit the bidirectional ownership relations
            emit(
                processingResult.relation({
                    type: RELATION_OWNED_BY,
                    source: {
                        kind: entity.kind,
                        namespace: entity.metadata.namespace || 'default',
                        name: entity.metadata.name,
                    },
                    target: parseEntityRef(ownerRef),
                }),
            );

            emit(
                processingResult.relation({
                    type: RELATION_OWNER_OF,
                    source: parseEntityRef(ownerRef),
                    target: {
                        kind: entity.kind,
                        namespace: entity.metadata.namespace || 'default',
                        name: entity.metadata.name,
                    },
                }),
            );
        }

        return entity;
    }
}
