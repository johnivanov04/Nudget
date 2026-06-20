/**
 * Shared repository helpers. Repositories are thin, typed wrappers over the
 * service-role Supabase client. They are exercised by integration tests in a
 * later phase (they need a live Postgres); Phase 1 keeps them compile-checked
 * and tested only at the pure-mapper boundary.
 */
import type { PostgrestError } from '@supabase/supabase-js';

export class RepositoryError extends Error {
  constructor(
    message: string,
    override readonly cause?: PostgrestError,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/** Throw a RepositoryError if a Supabase response carried an error. */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) {
    // NOTE: never include row data in the message — it may contain financial data.
    throw new RepositoryError(`Database error: ${result.error.message}`, result.error);
  }
  if (result.data === null) {
    throw new RepositoryError('Database returned no data');
  }
  return result.data;
}
