import { useEntity } from '@backstage/plugin-catalog-react';
import {
    MULTI_OWNER_ANNOTATION,
    parseOwners,
} from '@thecodingsheikh/backstage-plugin-multi-owner-common';
import type { MultiOwnerEntry } from '@thecodingsheikh/backstage-plugin-multi-owner-common';

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
