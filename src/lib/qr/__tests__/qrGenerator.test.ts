import { describe, it, expect } from 'vitest';
import { encodeQrMatrix, generateQrSvg, generateQrSvgUrl } from '../qrGenerator';

/**
 * These tests verify the hand-rolled encoder against the structural rules of
 * ISO/IEC 18004 and round-trip the payload back out of the finished matrix,
 * which is what catches placement, masking and interleaving mistakes.
 */

// Mirrors the encoder's private tables for level M.
const DATA_CODEWORDS_M: Record<number, number> = {
  1: 16, 2: 28, 3: 44, 4: 64, 5: 86, 6: 108, 7: 124, 8: 154, 9: 182, 10: 216,
};
const EC_CODEWORDS_M: Record<number, number> = {
  1: 10, 2: 16, 3: 26, 4: 36, 5: 48, 6: 64, 7: 72, 8: 88, 9: 110, 10: 130,
};
const EC_BLOCKS_M: Record<number, number[]> = {
  1: [1], 2: [1], 3: [1], 4: [2], 5: [2], 6: [4], 7: [4], 8: [2, 2], 9: [3, 2], 10: [4, 1],
};

function versionOf(matrix: boolean[][]): number {
  return (matrix.length - 17) / 4;
}

function maskBit(pattern: number, row: number, col: number): boolean {
  switch (pattern) {
    case 0: return (row + col) % 2 === 0;
    case 1: return row % 2 === 0;
    case 2: return col % 3 === 0;
    case 3: return (row + col) % 3 === 0;
    case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

/** Rebuilds the "is this module reserved for function patterns" map. */
function reservedMap(size: number, version: number): boolean[][] {
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const mark = (r: number, c: number) => {
    if (r >= 0 && c >= 0 && r < size && c < size) reserved[r]![c] = true;
  };

  // Finder patterns plus separators.
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) mark(br + r, bc + c);
  }
  // Timing patterns.
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  // Alignment patterns.
  const centers: Record<number, number[]> = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  for (const row of centers[version]!) {
    for (const col of centers[version]!) {
      const nearFinder =
        (row <= 8 && col <= 8) || (row <= 8 && col >= size - 9) || (row >= size - 9 && col <= 8);
      if (nearFinder) continue;
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) mark(row + r, col + c);
    }
  }
  // Format info.
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  // Version info (v7+).
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      mark(Math.floor(i / 3), size - 11 + (i % 3));
      mark(size - 11 + (i % 3), Math.floor(i / 3));
    }
  }
  return reserved;
}

/** Reads the codeword stream back out of a finished matrix. */
function extractCodewords(matrix: boolean[][], maskPattern = 2): number[] {
  const size = matrix.length;
  const version = versionOf(matrix);
  const reserved = reservedMap(size, version);
  const bits: number[] = [];
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    const rightCol = right <= 6 ? right - 1 : right;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [rightCol, rightCol - 1]) {
        if (col < 0 || reserved[row]![col]) continue;
        const stored = matrix[row]![col] ? 1 : 0;
        bits.push(maskBit(maskPattern, row, col) ? stored ^ 1 : stored);
      }
    }
    upward = !upward;
  }

  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j]!;
    codewords.push(byte);
  }
  return codewords;
}

/** Reverses the block interleaving to recover the ordered data codewords. */
function deinterleave(stream: number[], version: number): number[] {
  const blockCounts = EC_BLOCKS_M[version]!;
  const totalBlocks = blockCounts.reduce((a, b) => a + b, 0);
  const totalData = DATA_CODEWORDS_M[version]!;
  const shortLength = Math.floor(totalData / totalBlocks);
  const longBlocks = totalData % totalBlocks;

  const lengths = Array.from({ length: totalBlocks }, (_, i) =>
    shortLength + (i >= totalBlocks - longBlocks ? 1 : 0)
  );
  const blocks: number[][] = lengths.map(() => []);

  let index = 0;
  const maxLength = Math.max(...lengths);
  for (let i = 0; i < maxLength; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < lengths[b]!) blocks[b]!.push(stream[index++]!);
    }
  }
  return blocks.flat();
}

/** Decodes byte-mode payload from ordered data codewords. */
function decodePayload(dataCodewords: number[], version: number): string {
  const bits: number[] = [];
  for (const byte of dataCodewords) {
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  }
  const read = (count: number) => {
    let value = 0;
    for (let i = 0; i < count; i++) value = (value << 1) | bits.shift()!;
    return value;
  };

  expect(read(4)).toBe(0b0100); // byte mode
  const length = read(version < 10 ? 8 : 16);

  const bytes: number[] = [];
  for (let i = 0; i < length; i++) bytes.push(read(8));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function roundTrip(payload: string): string {
  const matrix = encodeQrMatrix(payload);
  const version = versionOf(matrix);
  const stream = extractCodewords(matrix);
  const ecTotal = EC_CODEWORDS_M[version]! * EC_BLOCKS_M[version]!.reduce((a, b) => a + b, 0);
  const dataStream = stream.slice(0, stream.length - ecTotal);
  return decodePayload(deinterleave(dataStream, version), version);
}

describe('qrGenerator', () => {
  it('round-trips a short payload', () => {
    expect(roundTrip('HELLO')).toBe('HELLO');
  });

  it('round-trips a realistic share URL', () => {
    const url = 'https://medfolio.app/share/8Jf2kLmQ9pZaW3vR7tYbN1xC5dE0hGsU6iOjPqAr';
    expect(roundTrip(url)).toBe(url);
  });

  it('round-trips a payload long enough to need a higher version', () => {
    const url = `https://medfolio.example.com/share/${'a'.repeat(120)}`;
    expect(roundTrip(url)).toBe(url);
  });

  it('places the three finder patterns', () => {
    const matrix = encodeQrMatrix('HELLO');
    const size = matrix.length;
    for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]] as const) {
      expect(matrix[br]![bc]).toBe(true); // outer ring corner
      expect(matrix[br + 1]![bc + 1]).toBe(false); // light ring
      expect(matrix[br + 3]![bc + 3]).toBe(true); // dark core
    }
  });

  it('places the timing patterns as alternating modules', () => {
    const matrix = encodeQrMatrix('HELLO');
    for (let i = 8; i < matrix.length - 8; i++) {
      expect(matrix[6]![i]).toBe(i % 2 === 0);
      expect(matrix[i]![6]).toBe(i % 2 === 0);
    }
  });

  it('sets the fixed dark module below the bottom-left finder', () => {
    const matrix = encodeQrMatrix('HELLO');
    expect(matrix[matrix.length - 8]![8]).toBe(true);
  });

  it('produces a square matrix of a valid version size', () => {
    const matrix = encodeQrMatrix('HELLO');
    expect(matrix.length).toBe(21); // version 1
    for (const row of matrix) expect(row.length).toBe(matrix.length);
  });

  it('renders an SVG with a quiet zone', () => {
    const svg = generateQrSvg('HELLO', 200);
    expect(svg).toContain('width="200"');
    expect(svg).toContain('viewBox="0 0 29 29"'); // 21 modules + 4 each side
    expect(svg).toContain('<path');
  });

  it('returns an inline data URL, never a remote service', () => {
    const url = generateQrSvgUrl('https://medfolio.app/share/abc123def456ghi789');
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(url).not.toContain('http://');
    expect(url.slice('data:image/svg+xml;base64,'.length)).not.toContain('qrserver');
  });

  it('rejects payloads beyond the supported version range', () => {
    expect(() => encodeQrMatrix('x'.repeat(300))).toThrow(/too long/i);
  });
});
