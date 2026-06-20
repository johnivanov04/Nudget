/**
 * GET /api/health — liveness probe. Intentionally does not touch the DB or any
 * secret so it is safe to expose for uptime monitoring.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', phase: 'phase-1-backend-foundation' });
}
