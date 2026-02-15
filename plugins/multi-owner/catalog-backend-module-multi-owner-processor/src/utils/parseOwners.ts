import { MultiOwnerEntry, MultiOwnerSpec } from './types';

/**
 * Normalizes a `spec.owners` value into a consistent array of
 * {@link MultiOwnerEntry} objects.
 *
 * Accepts both string shorthand (`"group:default/team"`) and
 * full objects (`{ name: "group:default/team", role: "maintainer" }`).
 *
 * @param raw - The raw `spec.owners` value from the entity YAML
 * @returns A normalized array of owner entries, or an empty array if input is invalid
 */
export function parseOwners(raw: unknown): MultiOwnerEntry[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const result: MultiOwnerEntry[] = [];

    for (const entry of raw as MultiOwnerSpec) {
        if (typeof entry === 'string') {
            const trimmed = entry.trim();
            if (trimmed.length > 0) {
                result.push({ name: trimmed });
            }
        } else if (
            typeof entry === 'object' &&
            entry !== null &&
            // @ts-ignore
            typeof entry.name === 'string'
        ) {
            // @ts-ignore
            const trimmedName = entry.name.trim();
            if (trimmedName.length > 0) {
                result.push({
                    name: trimmedName,
                    // @ts-ignore
                    ...(entry.role ? { role: entry.role.trim() } : {}),
                });
            }
        }
        // silently skip malformed entries
    }

    return result;
}
