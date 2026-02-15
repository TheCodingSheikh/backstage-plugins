/**
 * A single owner entry in the multi-owner spec.
 *
 * Can be declared as either:
 * - A plain entity reference string: `"group:default/platform-team"`
 * - An object with a name and optional role: `{ name: "group:default/platform-team", role: "maintainer" }`
 */
export interface MultiOwnerEntry {
    /** Entity reference string, e.g. `"group:default/platform-team"` */
    name: string;
    /** Optional human-readable role label, e.g. `"maintainer"`, `"tech-lead"` */
    role?: string;
}

/**
 * The raw value of `spec.owners` as it appears in the entity YAML.
 * Each element can be a string shorthand or a full object.
 */
export type MultiOwnerSpec = Array<string | MultiOwnerEntry>;
