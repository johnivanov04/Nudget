import { describe, it, expect } from 'vitest';
import { roundCents } from './money';

describe('roundCents', () => {
  it('rounds to two decimals', () => {
    expect(roundCents(33.846153)).toBe(33.85);
    expect(roundCents(0.1 + 0.2)).toBe(0.3); // float-drift case
    expect(roundCents(-300)).toBe(-300);
  });
  it('throws on non-finite values', () => {
    expect(() => roundCents(NaN)).toThrow(TypeError);
    expect(() => roundCents(Infinity)).toThrow(TypeError);
  });
});
