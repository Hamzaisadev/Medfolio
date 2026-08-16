/**
 * Document integrity stamping for exported/shared clinical documents.
 *
 * The checksum must be a real cryptographic digest: a non-cryptographic fallback
 * is trivially forgeable, so labelling one "tamper-evident" would be worse than
 * showing no stamp at all. When Web Crypto is unavailable we therefore fail
 * rather than downgrade.
 */

export class ChecksumUnavailableError extends Error {
  constructor() {
    super(
      'Cryptographic checksums require a secure context (HTTPS or localhost). ' +
        'This document cannot be stamped here.'
    );
    this.name = 'ChecksumUnavailableError';
  }
}

/** True when SHA-256 checksums can be computed in this context. */
export function isChecksumSupported(): boolean {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

/** Computes the SHA-256 hex digest of `payload`. */
export async function computeIntegrityChecksum(payload: string): Promise<string> {
  if (!isChecksumSupported()) {
    throw new ChecksumUnavailableError();
  }

  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface WatermarkMetadata {
  documentId: string;
  issuedAt: string;
  checksum: string;
  issuer: string;
  verificationUrl: string;
  securityStamp: string;
}

/**
 * Creates integrity metadata for a clinical PDF or share view.
 *
 * `origin` is injected rather than read from `window` so this stays usable from
 * tests and any non-browser context.
 */
export async function generateWatermarkMetadata(
  documentId: string,
  payloadString: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): Promise<WatermarkMetadata> {
  const checksum = await computeIntegrityChecksum(payloadString);
  const shortHash = checksum.slice(0, 12).toUpperCase();

  const params = new URLSearchParams({ doc: documentId, hash: shortHash });

  return {
    documentId,
    issuedAt: new Date().toISOString(),
    checksum,
    issuer: 'Medfolio Health Record Export',
    // Route registered in src/routes.tsx as /share/verify.
    verificationUrl: `${origin}/share/verify?${params.toString()}`,
    securityStamp: `MED-${shortHash}`,
  };
}
