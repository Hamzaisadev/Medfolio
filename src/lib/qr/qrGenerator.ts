/**
 * Self-contained QR Code generator (byte mode, ISO/IEC 18004).
 *
 * Share URLs carry a bearer token for a patient's medical record, so they must
 * never be sent to a third-party image service to be rendered. This encodes the
 * QR locally and returns an inline SVG data URL.
 *
 * Supports versions 1–10 with error-correction level M, which covers well beyond
 * the ~90 characters a share URL needs.
 */

const EC_CODEWORDS_M: Record<number, number> = {
  1: 10, 2: 16, 3: 26, 4: 36, 5: 48, 6: 64, 7: 72, 8: 88, 9: 110, 10: 130,
};

/** Total data codewords available at level M, per version. */
const DATA_CODEWORDS_M: Record<number, number> = {
  1: 16, 2: 28, 3: 44, 4: 64, 5: 86, 6: 108, 7: 124, 8: 154, 9: 182, 10: 216,
};

/** [blocksInGroup1, blocksInGroup2] error-correction block layout at level M. */
const EC_BLOCKS_M: Record<number, number[]> = {
  1: [1], 2: [1], 3: [1], 4: [2], 5: [2], 6: [4], 7: [4], 8: [2, 2], 9: [3, 2], 10: [4, 1],
};

const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---------------------------------------------------------------- GF(256) math

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!;
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a]! + GF_LOG[b]!) % 255]!;
}

function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] ?? 0) ^ gfMul(poly[j]!, 1);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, GF_EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data: number[], ecCount: number): number[] {
  const gen = generatorPoly(ecCount);
  const remainder = new Array<number>(ecCount).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i++) {
        remainder[i] = remainder[i]! ^ gfMul(gen[i + 1]!, factor);
      }
    }
  }
  return remainder;
}

// ------------------------------------------------------------- bit / codewords

class BitBuffer {
  readonly bits: number[] = [];

  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }
}

function characterCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= 10; version++) {
    const capacityBits = DATA_CODEWORDS_M[version]! * 8;
    const neededBits = 4 + characterCountBits(version) + byteLength * 8;
    if (neededBits <= capacityBits) return version;
  }
  throw new Error('Data too long for a version-10 QR code');
}

function buildCodewords(data: Uint8Array, version: number): number[] {
  const buffer = new BitBuffer();
  buffer.put(0b0100, 4); // byte mode
  buffer.put(data.length, characterCountBits(version));
  for (const byte of data) {
    buffer.put(byte, 8);
  }

  const totalDataBits = DATA_CODEWORDS_M[version]! * 8;
  // Terminator, then pad to a byte boundary.
  buffer.put(0, Math.min(4, totalDataBits - buffer.bits.length));
  while (buffer.bits.length % 8 !== 0) buffer.bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j]!;
    codewords.push(byte);
  }

  // Alternating pad bytes per spec.
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < DATA_CODEWORDS_M[version]!) {
    codewords.push(padBytes[padIndex++ % 2]!);
  }

  return interleave(codewords, version);
}

function interleave(dataCodewords: number[], version: number): number[] {
  const blockCounts = EC_BLOCKS_M[version]!;
  const totalBlocks = blockCounts.reduce((sum, n) => sum + n, 0);
  const totalData = DATA_CODEWORDS_M[version]!;
  const ecPerBlock = EC_CODEWORDS_M[version]!;

  const shortLength = Math.floor(totalData / totalBlocks);
  const longBlocks = totalData % totalBlocks;

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;

  for (let i = 0; i < totalBlocks; i++) {
    const length = shortLength + (i >= totalBlocks - longBlocks ? 1 : 0);
    const block = dataCodewords.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    ecBlocks.push(reedSolomon(block, ecPerBlock));
  }

  const result: number[] = [];
  const maxDataLength = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLength; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]!);
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) {
      result.push(block[i]!);
    }
  }
  return result;
}

// ------------------------------------------------------------------- matrix

type Matrix = Array<Array<0 | 1 | null>>;

function placeFinder(matrix: Matrix, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue;
      const onEdge = r === 0 || r === 6 || c === 0 || c === 6;
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[rr]![cc] = onEdge || inCore ? 1 : 0;
    }
  }
}

function placeAlignment(matrix: Matrix, version: number): void {
  const centers = ALIGNMENT_CENTERS[version]!;
  for (const row of centers) {
    for (const col of centers) {
      // Skip the three positions occupied by finder patterns.
      if (matrix[row]![col] !== null) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          matrix[row + r]![col + c] = isDark ? 1 : 0;
        }
      }
    }
  }
}

function placeTiming(matrix: Matrix): void {
  const size = matrix.length;
  for (let i = 8; i < size - 8; i++) {
    const bit: 0 | 1 = i % 2 === 0 ? 1 : 0;
    if (matrix[6]![i] === null) matrix[6]![i] = bit;
    if (matrix[i]![6] === null) matrix[i]![6] = bit;
  }
}

const FORMAT_MASK = 0b101010000010010;

function placeFormatInfo(matrix: Matrix, maskPattern: number): void {
  const size = matrix.length;
  // Level M = 0b00, then the 3-bit mask pattern.
  const data = (0b00 << 3) | maskPattern;
  let bch = data << 10;
  for (let i = 4; i >= 0; i--) {
    if (bch & (1 << (i + 10))) bch ^= 0b10100110111 << i;
  }
  const format = ((data << 10) | bch) ^ FORMAT_MASK;

  for (let i = 0; i < 15; i++) {
    const bit: 0 | 1 = ((format >> i) & 1) === 1 ? 1 : 0;

    // Copy 1, around the top-left finder.
    if (i < 6) matrix[i]![8] = bit;
    else if (i < 8) matrix[i + 1]![8] = bit;
    else if (i === 8) matrix[8]![7] = bit;
    else matrix[8]![14 - i] = bit;

    // Copy 2, split between top-right and bottom-left.
    if (i < 8) matrix[8]![size - 1 - i] = bit;
    else matrix[size - 15 + i]![8] = bit;
  }
  matrix[size - 8]![8] = 1; // fixed dark module
}

function placeVersionInfo(matrix: Matrix, version: number): void {
  if (version < 7) return;
  const size = matrix.length;
  let bch = version << 12;
  for (let i = 5; i >= 0; i--) {
    if (bch & (1 << (i + 12))) bch ^= 0b1111100100101 << i;
  }
  const info = (version << 12) | bch;

  for (let i = 0; i < 18; i++) {
    const bit: 0 | 1 = ((info >> i) & 1) === 1 ? 1 : 0;
    matrix[Math.floor(i / 3)]![size - 11 + (i % 3)] = bit;
    matrix[size - 11 + (i % 3)]![Math.floor(i / 3)] = bit;
  }
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

/**
 * Returns the module coordinates in codeword-placement order: two-module-wide
 * columns walked right-to-left, alternating upward/downward, skipping the
 * vertical timing pattern in column 6 and any reserved module.
 */
function placementOrder(size: number, reserved: Matrix): Array<[number, number]> {
  const order: Array<[number, number]> = [];
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    // Column 6 is the vertical timing pattern; the column pair shifts left past it.
    const rightCol = right <= 6 ? right - 1 : right;
    const cols = [rightCol, rightCol - 1];

    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of cols) {
        if (col < 0) continue;
        if (reserved[row]![col] !== null) continue;
        order.push([row, col]);
      }
    }
    upward = !upward;
  }
  return order;
}

function buildMatrix(codewords: number[], version: number, maskPattern: number): Matrix {
  const size = version * 4 + 17;
  const matrix: Matrix = Array.from({ length: size }, () =>
    new Array<0 | 1 | null>(size).fill(null)
  );

  placeFinder(matrix, 0, 0);
  placeFinder(matrix, 0, size - 7);
  placeFinder(matrix, size - 7, 0);
  placeAlignment(matrix, version);
  placeTiming(matrix);

  // Reserve format/version areas so data placement skips them.
  const reserved: Matrix = matrix.map((row) => [...row]);
  placeFormatInfo(reserved, 0);
  placeVersionInfo(reserved, version);

  const totalBits = codewords.length * 8;
  let bitIndex = 0;

  for (const [row, col] of placementOrder(size, reserved)) {
    let bit: 0 | 1 = 0;
    if (bitIndex < totalBits) {
      const byte = codewords[bitIndex >> 3]!;
      bit = ((byte >> (7 - (bitIndex & 7))) & 1) === 1 ? 1 : 0;
      bitIndex++;
    }
    matrix[row]![col] = maskBit(maskPattern, row, col) ? ((bit ^ 1) as 0 | 1) : bit;
  }

  placeFormatInfo(matrix, maskPattern);
  placeVersionInfo(matrix, version);

  return matrix;
}

// --------------------------------------------------------------------- public

/** Encodes `data` as a QR matrix of booleans (true = dark module). */
export function encodeQrMatrix(data: string): boolean[][] {
  const bytes = new TextEncoder().encode(data);
  const version = chooseVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);
  const matrix = buildMatrix(codewords, version, 2);
  return matrix.map((row) => row.map((cell) => cell === 1));
}

/** Renders `data` as an SVG string. */
export function generateQrSvg(data: string, size = 180): string {
  const matrix = encodeQrMatrix(data);
  const moduleCount = matrix.length;
  const quietZone = 4;
  const total = moduleCount + quietZone * 2;

  let path = '';
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (matrix[row]![col]) {
        path += `M${col + quietZone} ${row + quietZone}h1v1h-1z`;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="#ffffff"/>`,
    `<path d="${path}" fill="#000000"/>`,
    `</svg>`,
  ].join('');
}

/**
 * Returns an inline `data:` URL for the QR code.
 *
 * Inline, not a remote URL: the encoded value is a bearer token for medical
 * records and must not be transmitted to an external QR service.
 */
export function generateQrSvgUrl(data: string, size = 180): string {
  const svg = generateQrSvg(data, size);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
