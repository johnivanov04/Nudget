-- =============================================================================
-- APNs delivery — store the raw device token ENCRYPTED so the server can
-- actually send pushes.
--
-- `token_hash` (sha256) stays as the privacy-safe dedup/unique key. But a hash
-- is one-way, and APNs is addressed by the *raw* device token — so we add an
-- AES-256-GCM ciphertext column (same envelope as plaid_items.encrypted_access_token).
-- The plaintext token never lives in the DB, never reaches the client, and is
-- never logged. Nullable so pre-existing rows (hash-only) don't break; they get
-- backfilled the next time the device re-registers.
-- =============================================================================

alter table device_tokens
  add column token_encrypted text;
