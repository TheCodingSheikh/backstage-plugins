import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  Entity,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  parseEntityRef,
} from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { LoggerService } from '@backstage/backend-plugin-api';
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
  constructor(private readonly logger?: LoggerService) {}

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
    const entityNamespace = entity.metadata.namespace || 'default';
    const source = {
      kind: entity.kind,
      namespace: entityNamespace,
      name: entity.metadata.name,
    };

    for (const owner of owners) {
      let ownerRef;
      try {
        ownerRef = parseEntityRef(owner.name, {
          defaultKind: 'group',
          defaultNamespace: entityNamespace,
        });
      } catch (error) {
        this.logger?.debug(
          `Skipping invalid owner reference "${owner.name}" on ${source.kind}:${source.namespace}/${source.name}: ${error}`,
        );
        continue;
      }

      emit(
        processingResult.relation({
          type: RELATION_OWNED_BY,
          source,
          target: ownerRef,
        }),
      );

      emit(
        processingResult.relation({
          type: RELATION_OWNER_OF,
          source: ownerRef,
          target: source,
        }),
      );
    }

    return entity;
  }
}
