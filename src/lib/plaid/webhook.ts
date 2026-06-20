/**
 * Plaid webhook verification.
 *
 * Plaid signs each webhook with a JWT in the `Plaid-Verification` header (ES256).
 * We verify, using Node's built-in crypto only (no JWT library):
 *   1. the JWT signature against Plaid's published verification key (by `kid`),
 *   2. that the token is recent (replay protection), and
 *   3. that sha256(raw request body) matches the token's `request_body_sha256`.
 *
 * Any failure -> reject. The key fetch is injected so this is unit-testable with
 * a locally generated EC key (no network).
 */
import { createHash, createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto';

export interface VerifyPlaidWebhookParams {
  /** The exact raw request body string (must not be re-serialized). */
  rawBody: string;
  /** Value of the `Plaid-Verification` header. */
  verificationHeader: string | null | undefined;
  /** Resolve Plaid's verification JWK for a given key id. */
  getVerificationKey: (keyId: string) => Promise<JsonWebKey>;
  /** Injectable clock (ms) for deterministic tests. */
  now?: number;
  /** Max token age before we treat it as a replay. Default 5 minutes. */
  maxAgeSeconds?: number;
}

interface JwtHeader {
  alg?: string;
  kid?: string;
}
interface JwtClaims {
  iat?: number;
  request_body_sha256?: string;
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as T;
}

export async function verifyPlaidWebhook(params: VerifyPlaidWebhookParams): Promise<boolean> {
  const token = params.verificationHeader;
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: JwtHeader;
  try {
    header = decodeSegment<JwtHeader>(headerB64);
  } catch {
    return false;
  }
  // Only the algorithm Plaid uses is accepted (reject "none" / alg confusion).
  if (header.alg !== 'ES256' || !header.kid) return false;

  let jwk: JsonWebKey;
  try {
    jwk = await params.getVerificationKey(header.kid);
  } catch {
    return false;
  }

  let signatureValid = false;
  try {
    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
    signatureValid = cryptoVerify(
      'sha256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      // JWT ES256 signatures are raw r||s (IEEE P1363), not DER.
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureB64, 'base64url'),
    );
  } catch {
    return false;
  }
  if (!signatureValid) return false;

  let claims: JwtClaims;
  try {
    claims = decodeSegment<JwtClaims>(payloadB64);
  } catch {
    return false;
  }

  // Replay protection.
  const now = params.now ?? Date.now();
  const maxAgeMs = (params.maxAgeSeconds ?? 300) * 1000;
  if (typeof claims.iat !== 'number' || now - claims.iat * 1000 > maxAgeMs) return false;

  // Body integrity: the signed hash must match the body we actually received.
  const bodyHash = createHash('sha256').update(params.rawBody, 'utf8').digest('hex');
  if (claims.request_body_sha256 !== bodyHash) return false;

  return true;
}
