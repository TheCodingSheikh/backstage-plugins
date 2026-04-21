/**
 * Backend module for the catalog that processes `spec.owners` on entities
 * and emits proper ownership relations. Also contributes role-aware
 * permission rules for multi-owner entities.
 *
 * @packageDocumentation
 */
export { default } from './module';
export { MultiOwnerEntitiesProcessor } from './MultiOwnerEntitiesProcessor';
export {
  isEntityMultiOwnerWithRole,
  isEntityMultiOwnerWithAnnotationRole,
} from './permissions';
