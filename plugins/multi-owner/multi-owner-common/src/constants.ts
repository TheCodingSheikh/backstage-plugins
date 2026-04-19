/**
 * Annotation key used to store the normalized list of owners as JSON
 * on a processed entity. This is written by the backend processor and
 * read by the frontend card.
 */
export const MULTI_OWNER_ANNOTATION = 'backstage.io/owners';

/**
 * The field name under `spec` where multiple owners are declared
 * in the entity YAML.
 */
export const MULTI_OWNER_SPEC_FIELD = 'owners';
