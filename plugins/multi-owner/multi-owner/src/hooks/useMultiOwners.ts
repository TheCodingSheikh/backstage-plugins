import { useEntity } from '@backstage/plugin-catalog-react';
import { MULTI_OWNER_ANNOTATION } from '../utils/constants';
import { parseOwners } from '../utils/parseOwners';
import type { MultiOwnerEntry } from '../utils/types';

/**
 * Custom hook that reads the multi-owner annotation from the current
 * entity context and returns a typed array of owner entries.
 *
 * @returns An object containing:
 * - `owners`: The parsed array of {@link MultiOwnerEntry} objects
 *
 * @example
 * ```tsx
    * const { owners } = useMultiOwners();
 * ```
 */
export function useMultiOwners(): {
    owners: MultiOwnerEntry[];
} {
    const { entity } = useEntity();

    const annotation =
        entity.metadata.annotations?.[MULTI_OWNER_ANNOTATION];

    if (!annotation) {
        // Fall back to spec.owner if present
        const specOwner = (entity.spec as Record<string, unknown> | undefined)
            ?.owner;
        if (typeof specOwner === 'string' && specOwner.trim()) {
            return {
                owners: [{ name: specOwner.trim() }],
            };
        }
        return { owners: [] };
    }

    try {
        const parsed = JSON.parse(annotation);
        return { owners: parseOwners(parsed) };
    } catch {
        return { owners: [] };
    }
}
