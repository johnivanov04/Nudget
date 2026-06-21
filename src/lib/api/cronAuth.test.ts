import { describe, it, expect } from 'vitest';
import { isValidCronRequest } from './cronAuth';

describe('isValidCronRequest', () => {
  it('accepts a matching bearer secret', () => {
    expect(isValidCronRequest('Bearer s3cr3t', 's3cr3t')).toBe(true);
  });
  it('rejects a wrong or missing token', () => {
    expect(isValidCronRequest('Bearer nope', 's3cr3t')).toBe(false);
    expect(isValidCronRequest(null, 's3cr3t')).toBe(false);
    expect(isValidCronRequest('s3cr3t', 's3cr3t')).toBe(false); // not a bearer
  });
  it('fails closed when no secret is configured', () => {
    expect(isValidCronRequest('Bearer anything', undefined)).toBe(false);
  });
});
