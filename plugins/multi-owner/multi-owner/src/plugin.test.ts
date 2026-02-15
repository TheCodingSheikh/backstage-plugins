import { multiOwnerPlugin, isMultiOwnerAvailable } from './plugin';

describe('multi-owner plugin', () => {
    it('should export plugin', () => {
        expect(multiOwnerPlugin).toBeDefined();
    });

    it('isMultiOwnerAvailable returns true when annotation is present', () => {
        const entity = {
            apiVersion: 'backstage.io/v1alpha1' as const,
            kind: 'Component',
            metadata: {
                name: 'test',
                annotations: {
                    'backstage.io/owners': '[]',
                },
            },
        };
        expect(isMultiOwnerAvailable(entity)).toBe(true);
    });

    it('isMultiOwnerAvailable returns false when annotation is absent', () => {
        const entity = {
            apiVersion: 'backstage.io/v1alpha1' as const,
            kind: 'Component',
            metadata: {
                name: 'test',
            },
        };
        expect(isMultiOwnerAvailable(entity)).toBe(false);
    });
});
