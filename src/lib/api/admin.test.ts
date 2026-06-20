import { describe, it, expect } from 'vitest';
import { isAdmin, parseAdminIds } from './admin';

describe('admin authorization', () => {
  it('parses a comma-separated allowlist, trimming blanks', () => {
    expect([...parseAdminIds(' a , b ,, c ')]).toEqual(['a', 'b', 'c']);
    expect(parseAdminIds(undefined).size).toBe(0);
    expect(parseAdminIds('').size).toBe(0);
  });

  it('grants only listed user ids', () => {
    expect(isAdmin('user-A', 'user-A,user-B')).toBe(true);
    expect(isAdmin('user-C', 'user-A,user-B')).toBe(false);
    expect(isAdmin('user-A', undefined)).toBe(false);
  });
});
