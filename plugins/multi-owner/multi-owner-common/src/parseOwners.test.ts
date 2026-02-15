import { parseOwners } from './parseOwners';

describe('parseOwners', () => {
    it('returns empty array for undefined input', () => {
        expect(parseOwners(undefined)).toEqual([]);
    });

    it('returns empty array for null input', () => {
        expect(parseOwners(null)).toEqual([]);
    });

    it('returns empty array for non-array input', () => {
        expect(parseOwners('not-an-array')).toEqual([]);
        expect(parseOwners(42)).toEqual([]);
        expect(parseOwners({})).toEqual([]);
    });

    it('parses string entries', () => {
        expect(
            parseOwners(['group:default/platform-team', 'user:default/jane']),
        ).toEqual([
            { name: 'group:default/platform-team' },
            { name: 'user:default/jane' },
        ]);
    });

    it('parses object entries with name only', () => {
        expect(
            parseOwners([{ name: 'group:default/platform-team' }]),
        ).toEqual([{ name: 'group:default/platform-team' }]);
    });

    it('parses object entries with name and role', () => {
        expect(
            parseOwners([
                { name: 'group:default/platform-team', role: 'maintainer' },
                { name: 'user:default/jane', role: 'tech-lead' },
            ]),
        ).toEqual([
            { name: 'group:default/platform-team', role: 'maintainer' },
            { name: 'user:default/jane', role: 'tech-lead' },
        ]);
    });

    it('handles mixed string and object entries', () => {
        expect(
            parseOwners([
                'group:default/platform-team',
                { name: 'user:default/jane', role: 'tech-lead' },
            ]),
        ).toEqual([
            { name: 'group:default/platform-team' },
            { name: 'user:default/jane', role: 'tech-lead' },
        ]);
    });

    it('trims whitespace from names and roles', () => {
        expect(
            parseOwners([
                '  group:default/platform-team  ',
                { name: '  user:default/jane  ', role: '  tech-lead  ' },
            ]),
        ).toEqual([
            { name: 'group:default/platform-team' },
            { name: 'user:default/jane', role: 'tech-lead' },
        ]);
    });

    it('skips empty string entries', () => {
        expect(parseOwners(['', '  ', 'group:default/team'])).toEqual([
            { name: 'group:default/team' },
        ]);
    });

    it('skips malformed object entries', () => {
        expect(
            parseOwners([
                { role: 'missing-name' },
                { name: 123 },
                { name: '' },
                { name: 'group:default/valid' },
            ]),
        ).toEqual([{ name: 'group:default/valid' }]);
    });

    it('returns empty array for empty input array', () => {
        expect(parseOwners([])).toEqual([]);
    });
});
