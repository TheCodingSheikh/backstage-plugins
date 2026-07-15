import { canAdmin, canEdit } from './types';

describe('application roles', () => {
  it('keeps viewer read-only', () => { expect(canEdit('view')).toBe(false); expect(canAdmin('view')).toBe(false); });
  it('lets editor manage resources only', () => { expect(canEdit('edit')).toBe(true); expect(canAdmin('edit')).toBe(false); });
  it('lets admin manage resources and access', () => { expect(canEdit('admin')).toBe(true); expect(canAdmin('admin')).toBe(true); });
});
