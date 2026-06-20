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

export function serverError(message = 'Internal server error'): NextResponse {
  return NextResponse.json({ error: 'server_error', message }, { status: 500 });
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
