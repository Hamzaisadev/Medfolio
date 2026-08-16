/**
 * Share token generation and hashing.
 *
 * The raw token is the bearer credential for a patient's medical brief, so:
 * - it is generated from `crypto.getRandomValues` (never `Math.random`), and
 * - only its SHA-256 hash is persisted, so a database read cannot produce a
 *   working link.
 *
 * The raw token exists in memory just long enough to build the URL/QR, plus an
 * optional local copy on the creating device so the patient can re-open the link
 * later (see `rememberShareToken`).
 */

const TOKEN_BYTES = 32;
const LOCAL_TOKEN_KEY = 'medfolio_share_tokens_v1';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generates a cryptographically random, URL-safe share token. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** Returns the lowercase hex SHA-256 of `token`, matching the DB's `token_hash`. */
export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Stores the raw token on this device only, keyed by share id, so the patient
 * can re-copy or re-display the QR for a link they created here. Shares created
 * on another device will show as "link unavailable on this device".
 */
export function rememberShareToken(shareId: string, token: string): void {
  try {
    const all = readLocalTokens();
    all[shareId] = token;
    localStorage.setItem(LOCAL_TOKEN_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable — the caller still has the token for this session.
  }
}

export function recallShareToken(shareId: string): string | null {
  return readLocalTokens()[shareId] ?? null;
}

export function forgetShareToken(shareId: string): void {
  try {
    const all = readLocalTokens();
    delete all[shareId];
    localStorage.setItem(LOCAL_TOKEN_KEY, JSON.stringify(all));
  } catch {
    // Nothing to clean up.
  }
}

function readLocalTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_TOKEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
