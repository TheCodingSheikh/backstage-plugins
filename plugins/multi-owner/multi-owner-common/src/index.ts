/**
 * Shared types, constants and helpers used by the multi-owner frontend
 * plugin and the catalog-backend multi-owner processor module.
 *
 * @packageDocumentation
 */

export { MULTI_OWNER_ANNOTATION, MULTI_OWNER_SPEC_FIELD } from './constants';
export { parseOwners } from './parseOwners';
export type { MultiOwnerEntry, MultiOwnerSpec } from './types';
