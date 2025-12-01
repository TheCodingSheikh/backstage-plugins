import { Entity } from '@backstage/catalog-model';
import {
  ENTITY_SCAFFOLDER_CONFIG_ANNOTATION,
  ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION
} from '../annotations';

export const isEntityScaffolderAvailable = (entity: Entity) =>
  Boolean(entity?.metadata.annotations?.[ENTITY_SCAFFOLDER_CONFIG_ANNOTATION] &&
    entity?.metadata.annotations?.[ENTITY_SCAFFOLDER_TEMPLATE_ANNOTATION]);
