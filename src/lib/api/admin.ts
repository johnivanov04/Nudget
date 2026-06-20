/**
 * Admin authorization. Admin access is granted to user ids listed in the
 * `ADMIN_USER_IDS` env var (comma-separated). Pure + testable: the list is
 * passed in, not read from the environment here.
 */
export function parseAdminIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function isAdmin(userId: string, adminIdsRaw: string | undefined): boolean {
  return parseAdminIds(adminIdsRaw).has(userId);
}
