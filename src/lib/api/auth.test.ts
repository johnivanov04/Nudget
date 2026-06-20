import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the anon Supabase client so getUserFromRequest never touches env/network.
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseAnon: () => ({ auth: { getUser } }),
}));

import { extractBearerToken, getUserFromRequest } from './auth';

function reqWithAuth(header?: string): NextRequest {
  return new NextRequest('http://t/api/me', {
    method: 'GET',
    headers: header ? { authorization: header } : {},
  });
}

describe('extractBearerToken', () => {
  it('extracts a bearer token (case-insensitive)', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer xyz')).toBe('xyz');
  });
  it('returns null for missing / malformed headers', () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer   ')).toBeNull();
  });
});

describe('getUserFromRequest', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it('returns null when no Authorization header is present (no verification call)', async () => {
    const user = await getUserFromRequest(reqWithAuth());
    expect(user).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('returns the user for a valid token', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'a@b.com' } },
      error: null,
    });
    const user = await getUserFromRequest(reqWithAuth('Bearer good-token'));
    expect(user).toEqual({ userId: 'user-123', email: 'a@b.com' });
    expect(getUser).toHaveBeenCalledWith('good-token');
  });

  it('returns null when verification reports an error', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    expect(await getUserFromRequest(reqWithAuth('Bearer bad'))).toBeNull();
  });

  it('returns null (never throws) when verification throws', async () => {
    getUser.mockRejectedValue(new Error('network down'));
    expect(await getUserFromRequest(reqWithAuth('Bearer x'))).toBeNull();
  });
});
