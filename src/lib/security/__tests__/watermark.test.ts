import { describe, it, expect } from 'vitest';
import {
  computeIntegrityChecksum,
  generateWatermarkMetadata,
  isChecksumSupported,
} from '../watermark';

describe('Security & Watermark Engine', () => {
  it('generates consistent checksums for identical payloads', async () => {
    const payload = JSON.stringify({ patient: 'Test', med: 'Metformin 500mg' });
    const hash1 = await computeIntegrityChecksum(payload);
    const hash2 = await computeIntegrityChecksum(payload);
    expect(hash1).toBe(hash2);
  });

  it('generates different checksums when payload changes', async () => {
    const hash1 = await computeIntegrityChecksum('Payload A');
    const hash2 = await computeIntegrityChecksum('Payload B');
    expect(hash1).not.toBe(hash2);
  });

  it('produces a full-length SHA-256 hex digest', async () => {
    const hash = await computeIntegrityChecksum('Payload A');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the known SHA-256 digest of a fixed input', async () => {
    // Guards against a silent downgrade to a weaker digest.
    expect(await computeIntegrityChecksum('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('reports checksum support in this environment', () => {
    expect(isChecksumSupported()).toBe(true);
  });

  it('builds verification metadata against an injected origin', async () => {
    const meta = await generateWatermarkMetadata('doc-1', 'payload', 'https://medfolio.test');

    expect(meta.documentId).toBe('doc-1');
    expect(meta.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(meta.securityStamp).toBe(`MED-${meta.checksum.slice(0, 12).toUpperCase()}`);
    expect(meta.verificationUrl).toBe(
      `https://medfolio.test/share/verify?doc=doc-1&hash=${meta.checksum.slice(0, 12).toUpperCase()}`
    );
    expect(Date.parse(meta.issuedAt)).not.toBeNaN();
  });

  it('url-encodes document ids in the verification link', async () => {
    const meta = await generateWatermarkMetadata('doc 1&x=2', 'payload', 'https://medfolio.test');
    expect(meta.verificationUrl).toContain('doc=doc+1%26x%3D2');
  });
});
