import { MultiOwnerEntry } from './types';

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

  for (const entry of raw) {
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        result.push({ name: trimmed });
      }
      continue;
    }

    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { name?: unknown }).name === 'string'
    ) {
      const record = entry as { name: string; role?: unknown };
      const trimmedName = record.name.trim();
      if (trimmedName.length === 0) {
        continue;
      }
      const role =
        typeof record.role === 'string' && record.role.trim().length > 0
          ? record.role.trim()
          : undefined;
      result.push(role ? { name: trimmedName, role } : { name: trimmedName });
    }
    // silently skip malformed entries
  }

  return result;
}
