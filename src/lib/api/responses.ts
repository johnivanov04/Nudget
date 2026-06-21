/**
 * Small helpers for consistent JSON API responses.
 *
 * Error bodies never include raw financial data. The `notImplemented` helper is
 * used by Phase-1 stub routes so every placeholder advertises exactly what it
 * will do and what is blocking it.
 */
import { NextResponse } from 'next/server';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: 'bad_request', message, details }, { status: 400 });
}

export function unauthorized(message = 'Authentication required'): NextResponse {
  return NextResponse.json({ error: 'unauthorized', message }, { status: 401 });
}

export function forbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: 'forbidden', message }, { status: 403 });
}

export function notFound(message = 'Not found'): NextResponse {
  return NextResponse.json({ error: 'not_found', message }, { status: 404 });
}

export function serverError(message = 'Internal server error'): NextResponse {
  return NextResponse.json({ error: 'server_error', message }, { status: 500 });
}

export function tooManyRequests(resetAt: number): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'rate_limited', message: 'Too many requests', retryAfterSeconds: retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

/**
 * Phase-1 placeholder. Returns 501 with a machine-readable description of the
 * planned behavior and the dependency that must land first.
 */
export function notImplemented(params: {
  endpoint: string;
  phase: string;
  todo: string;
}): NextResponse {
  return NextResponse.json(
    {
      error: 'not_implemented',
      endpoint: params.endpoint,
      phase: params.phase,
      todo: params.todo,
    },
    { status: 501 },
  );
}
