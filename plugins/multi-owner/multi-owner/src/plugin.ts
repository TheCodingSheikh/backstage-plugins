import {
    createPlugin,
    createComponentExtension,
} from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { MULTI_OWNER_ANNOTATION } from './utils/constants';

/**
 * The multi-owner frontend plugin.
 */
export const multiOwnerPlugin = createPlugin({
    id: 'multi-owner',
});

/**
 * An info card component that displays the list of owners (with optional roles)
 * for an entity that uses `spec.owners`.
 *
 * @remarks
 * Place this card on entity pages in your Backstage app:
 * ```tsx
 * <EntitySwitch>
 *   <EntitySwitch.Case if={isMultiOwnerAvailable}>
 *     <EntityMultiOwnerCard />
 *   </EntitySwitch.Case>
 * </EntitySwitch>
 * ```
 */
export const EntityMultiOwnerCard = multiOwnerPlugin.provide(
    createComponentExtension({
        name: 'EntityMultiOwnerCard',
        component: {
            lazy: () =>
                import('./components/EntityMultiOwnerCard').then(
                    m => m.EntityMultiOwnerCard,
                ),
        },
    }),
);

/**
 * Utility function that checks whether the multi-owner annotation is
 * present on an entity. Use with `EntitySwitch` to conditionally render
 * the card only when relevant.
 */
export function isMultiOwnerAvailable(entity: Entity): boolean {
    return Boolean(entity.metadata.annotations?.[MULTI_OWNER_ANNOTATION]);
}
