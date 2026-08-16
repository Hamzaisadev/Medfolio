/**
 * Clinical Reference Range Parsing and Evaluation.
 *
 * Implements authoritative reference range arithmetic per 06-DOMAIN-RULES.md:
 * - Pure deterministic arithmetic (NEVER model-derived).
 * - "unknown" is a first-class result displaying as "Not evaluated".
 * - Sex-specific range resolution based on user profile sex.
 * - Qualitative vs quantitative distinction.
 */

export type RangeStatus = 'within' | 'below' | 'above' | 'unknown';

export interface ParsedRange {
  low: number | null;
  high: number | null;
  qualitativeExpected?: string | null;
}

/**
 * Strips common clinical lab units from the range string without mangling numbers.
 */
function stripUnits(text: string): string {
  return text
    .replace(/\b(?:mg\/dl|g\/dl|mmol\/l|miu\/l|iu\/l|pg\/ml|ng\/ml|ul|\/ul|cells\/cu\.mm|fl|pg)\b/gi, '')
    .replace(/%/g, '')
    .trim();
}

/**
 * Parses reference range text into low and high numeric boundaries.
 * Supports intervals ("12.0 - 16.0", "12 to 16", "12–16"),
 * single-sided bounds ("< 100", "upto 100", "> 40", ">= 40"),
 * and sex-specific ranges ("M: 13-17, F: 12-15").
 */
export function parseRange(
  text: string | null | undefined,
  sex?: 'male' | 'female' | 'other' | 'undisclosed' | null
): ParsedRange {
  if (!text) {
    return { low: null, high: null };
  }

  const raw = text.trim();
  if (!raw) return { low: null, high: null };

  // 1. Handle sex-specific ranges (e.g. "M: 13-17, F: 12-15" or "Male: 13-17 | Female: 12-15")
  if (/(?:m|male)\s*:\s*([^,;|]+)/i.test(raw) && /(?:f|female)\s*:\s*([^,;|]+)/i.test(raw)) {
    if (sex === 'male') {
      const malePart = raw.match(/(?:m|male)\s*:\s*([^,;|]+)/i)?.[1]?.trim();
      if (malePart) return parseRange(malePart);
    } else if (sex === 'female') {
      const femalePart = raw.match(/(?:f|female)\s*:\s*([^,;|]+)/i)?.[1]?.trim();
      if (femalePart) return parseRange(femalePart);
    } else {
      // If user sex is unspecified or other, return unknown rather than guessing
      return { low: null, high: null };
    }
  }

  // 2. Qualitative expected results
  const qualitativeList = ['negative', 'non-reactive', 'nil', 'absent', 'normal'];
  const lower = raw.toLowerCase();
  for (const q of qualitativeList) {
    if (lower === q || lower.includes(`expected: ${q}`) || lower.includes(`should be ${q}`)) {
      return { low: null, high: null, qualitativeExpected: q };
    }
  }

  const cleaned = stripUnits(raw);

  // 3. Interval: "12.0 - 16.0", "12 – 16", "12 to 16", "12-16", "12—16"
  const intervalMatch = cleaned.match(/^([0-9.]+)\s*(?:-|–|—|\bto\b)\s*([0-9.]+)$/i);
  if (intervalMatch && intervalMatch[1] && intervalMatch[2]) {
    const low = parseFloat(intervalMatch[1]);
    const high = parseFloat(intervalMatch[2]);
    if (!isNaN(low) && !isNaN(high)) {
      return { low: Math.min(low, high), high: Math.max(low, high) };
    }
  }

  // 4. Upper bound only: "< 100", "<= 100", "less than 100", "upto 100", "up to 100"
  const upperMatch =
    cleaned.match(/^(?:<=?|<|less\s+than|upto|up\s+to)\s*([0-9.]+)/i) ||
    cleaned.match(/^[<≤]\s*([0-9.]+)/i);
  if (upperMatch && upperMatch[1]) {
    const high = parseFloat(upperMatch[1]);
    return isNaN(high) ? { low: null, high: null } : { low: null, high };
  }

  // 5. Lower bound only: "> 40", ">= 40", "greater than 40", "more than 40"
  const lowerMatch =
    cleaned.match(/^(?:>=?|>|greater\s+than|more\s+than)\s*([0-9.]+)/i) ||
    cleaned.match(/^[>≥]\s*([0-9.]+)/i);
  if (lowerMatch && lowerMatch[1]) {
    const low = parseFloat(lowerMatch[1]);
    return isNaN(low) ? { low: null, high: null } : { low, high: null };
  }

  return { low: null, high: null };
}

/**
 * Evaluates whether a measured lab result falls within, below, or above reference range.
 */
export function evaluateRange(
  value: number | string | null | undefined,
  low: number | null,
  high: number | null,
  qualitativeExpected?: string | null
): RangeStatus {
  if (value === null || value === undefined || value === '') {
    return 'unknown';
  }

  // If qualitative evaluation
  if (typeof value === 'string' && isNaN(Number(value))) {
    if (!qualitativeExpected) return 'unknown';
    const valLower = value.trim().toLowerCase();
    const expLower = qualitativeExpected.trim().toLowerCase();
    if (valLower === expLower) return 'within';
    if (valLower === 'positive' || valLower === 'reactive' || valLower === 'present') {
      return 'above';
    }
    return 'unknown';
  }

  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) {
    return 'unknown';
  }

  // If no range boundaries could be parsed
  if (low === null && high === null) {
    return 'unknown';
  }

  if (low !== null && num < low) {
    return 'below';
  }
  if (high !== null && num > high) {
    return 'above';
  }
  return 'within';
}

/**
 * High-level helper for UI components: parses raw range string and evaluates value.
 */
export function evaluateLabResult(
  valueText: string | number | null | undefined,
  referenceRangeText?: string | null | undefined
): {
  status: 'within_range' | 'outside_range' | 'qualitative' | 'unevaluated';
  rangeStatus: RangeStatus;
  low: number | null;
  high: number | null;
} {
  const parsed = parseRange(referenceRangeText);
  if (parsed.qualitativeExpected) {
    const valStr = String(valueText || '').trim().toLowerCase();
    if (valStr === parsed.qualitativeExpected.toLowerCase()) {
      return { status: 'within_range', rangeStatus: 'within', low: null, high: null };
    }
    return { status: 'qualitative', rangeStatus: 'unknown', low: null, high: null };
  }

  const rangeStatus = evaluateRange(valueText, parsed.low, parsed.high, parsed.qualitativeExpected);
  if (rangeStatus === 'within') {
    return { status: 'within_range', rangeStatus, low: parsed.low, high: parsed.high };
  }
  if (rangeStatus === 'below' || rangeStatus === 'above') {
    return { status: 'outside_range', rangeStatus, low: parsed.low, high: parsed.high };
  }
  return { status: 'unevaluated', rangeStatus, low: parsed.low, high: parsed.high };
}
