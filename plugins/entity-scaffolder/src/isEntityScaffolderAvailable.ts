import { Entity } from '@backstage/catalog-model';
import {
  ENTITY_SCAFFOLDER_ANNOTATION,
} from './constants';

export const isEntityScaffolderAvailable = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.[ENTITY_SCAFFOLDER_ANNOTATION])
