/**
 * Clinical Frequency Parsing & Dose Timing.
 *
 * Implements authoritative Latin abbreviation, local dialect translation,
 * numeric slot notation (e.g. 1+0+1, 1+1+1, 1-0-1, ১+০+১, ۱+۰+۱), and OCR artifact recovery.
 * Rules:
 * 1. Unrecognised input returns null (never guess).
 * 2. PRN / SOS generates NO scheduled doses (returns empty array).
 * 3. Meal relation adjusts morning dose (e.g. empty stomach -> 07:00 instead of 09:00).
 */

export type FrequencyCode =
  | 'OD'
  | 'BD'
  | 'TDS'
  | 'QID'
  | 'QHS'
  | 'PRN'
  | 'SOS'
  | 'STAT'
  | 'WEEKLY'
  | 'CUSTOM';
/**
 * Normalizes Eastern Arabic, Urdu, Bengali, and Devanagari digits to ASCII digits.
 */
function normalizeDigits(str: string): string {
  const digitMap: Record<string, string> = {
    // Bengali digits (১=1, ০=0, ২=2, ৩=3)
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    // Eastern Arabic & Urdu digits (۱=1, ۰=0, ۲=2, ۳=3)
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    // Devanagari digits (१=1, ०=0, २=2, ३=3)
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  };

  return str.replace(/[০-৯۰-۹०-९]/g, (ch) => digitMap[ch] || ch);
}

/**
 * Normalizes input string for robust word matching:
 * - Lowercases
 * - Removes dots (o.d. -> od, b.i.d. -> bid)
 * - Normalizes separators and whitespace
 */
function normalizeText(str: string): string {
  const digitsClean = normalizeDigits(str);
  return digitsClean
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[/#!$%^&*;:{}=_`~(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses raw medical frequency shorthand into a standardized FrequencyCode.
 * Returns null if the input cannot be confidently identified.
 */
export function parseFrequency(raw: string | null | undefined): FrequencyCode | null {
  if (!raw) return null;

  // 1. First test numeric slot notation (e.g. 1+0+1, ১+০+১, >+0+>, 1-0-1, 1+1+1)
  const slotRaw = normalizeDigits(raw.trim()).replace(/[><|]/g, '1');
  const slotMatch = slotRaw.match(
    /^(\d+)\s*[+\-x/\\.]\s*(\d+)(?:\s*[+\-x/\\.]\s*(\d+))?(?:\s*[+\-x/\\.]\s*(\d+))?$/
  );

  if (slotMatch) {
    const d1 = parseInt(slotMatch[1] || '0', 10);
    const d2 = parseInt(slotMatch[2] || '0', 10);
    const d3 = slotMatch[3] !== undefined ? parseInt(slotMatch[3], 10) : null;
    const d4 = slotMatch[4] !== undefined ? parseInt(slotMatch[4], 10) : null;

    if (d4 !== null) {
      const count = (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0) + ((d3 || 0) > 0 ? 1 : 0) + (d4 > 0 ? 1 : 0);
      if (count === 4) return 'QID';
      if (count === 3) return 'TDS';
      if (count === 2) return 'BD';
      if (count === 1) return d4 > 0 ? 'QHS' : 'OD';
    }

    if (d3 !== null) {
      const count = (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0) + (d3 > 0 ? 1 : 0);
      if (count === 3) return 'TDS';
      if (count === 2) return 'BD';
      if (count === 1) {
        if (d3 > 0 && d1 === 0 && d2 === 0) return 'QHS';
        return 'OD';
      }
    }

    const count2 = (d1 > 0 ? 1 : 0) + (d2 > 0 ? 1 : 0);
    if (count2 === 2) return 'BD';
    if (count2 === 1) {
      if (d2 > 0 && d1 === 0) return 'QHS';
      return 'OD';
    }
  }

  const input = normalizeText(raw);
  if (!input) return null;

  // 2. Check exact hourly patterns (e.g. "q8h", "q12h", "8 hourly", "q 8 h")
  const hourlyMatch = input.match(/\bq\s*(\d{1,2})\s*h\b/) || input.match(/\b(\d{1,2})\s*hourly\b/);
  if (hourlyMatch && hourlyMatch[1]) {
    const hours = parseInt(hourlyMatch[1], 10);
    if (hours === 24) return 'OD';
    if (hours === 12) return 'BD';
    if (hours === 8) return 'TDS';
    if (hours === 6) return 'QID';
    return 'CUSTOM';
  }

  // 3. PRN / SOS
  if (
    input === 'prn' ||
    input === 'sos' ||
    input.includes('as needed') ||
    input.includes('if required') ||
    input.includes('when necessary') ||
    input.includes('when required') ||
    input.includes('zaroorat par') ||
    input.includes('zarurat') ||
    input.includes('zaroorat') ||
    input.includes('ضرورت')
  ) {
    return 'PRN';
  }

  // 4. STAT / Immediately
  if (
    input === 'stat' ||
    input === 'immediately' ||
    input === 'at once' ||
    input === 'abhi' ||
    input.includes('fauran') ||
    input.includes('foran') ||
    input.includes('فوراً')
  ) {
    return 'STAT';
  }

  // 5. QHS / Night only
  if (
    input === 'qhs' ||
    input === 'hs' ||
    input === 'night' ||
    input === 'at night' ||
    input === 'bedtime' ||
    input === 'before sleep' ||
    input === 'nocte' ||
    input === 'at bedtime' ||
    input === 'raat' ||
    input === 'raat ko' ||
    input === 'sote waqt' ||
    input.includes('sone se pehle') ||
    input.includes('سوتے وقت') ||
    input.includes('رات')
  ) {
    return 'QHS';
  }

  // 6. Weekly / Alternate
  if (
    input === 'weekly' ||
    input === 'once a week' ||
    input === 'once weekly' ||
    input === 'q7d' ||
    input === 'hafte me ek baar' ||
    input === 'hafte me aik baar' ||
    input.includes('ہفتے میں ایک بار')
  ) {
    return 'WEEKLY';
  }

  // 7. QID (4 times daily)
  if (
    input === 'qid' ||
    input === 'qds' ||
    input === '4x' ||
    input.includes('four times') ||
    input.includes('4 times') ||
    input.includes('chaar baar') ||
    input.includes('char bar') ||
    input.includes('چار بار')
  ) {
    return 'QID';
  }

  // 8. TDS / TID (3 times daily)
  if (
    input === 'tds' ||
    input === 'tid' ||
    input === '3x' ||
    input === 'thrice' ||
    input.includes('three times') ||
    input.includes('3 times') ||
    input.includes('thrice daily') ||
    input.includes('thrice a day') ||
    input.includes('teen baar') ||
    input.includes('تین بار')
  ) {
    return 'TDS';
  }

  // 9. BD / BID (2 times daily)
  if (
    input === 'bd' ||
    input === 'bid' ||
    input === '2x' ||
    input === 'twice' ||
    input.includes('twice daily') ||
    input.includes('twice a day') ||
    input.includes('2 times') ||
    input.includes('two times') ||
    input.includes('do baar') ||
    input.includes('دو بار')
  ) {
    return 'BD';
  }

  // 10. OD (Once daily)
  if (
    input === 'od' ||
    input === '1x' ||
    input === 'once' ||
    input === 'daily' ||
    input.includes('once daily') ||
    input.includes('once a day') ||
    input.includes('1 time') ||
    input.includes('one time') ||
    input.includes('ek baar') ||
    input.includes('aik baar') ||
    input.includes('ایک بار') ||
    input.includes('روزانہ')
  ) {
    return 'OD';
  }

  return null;
}

/**
 * Returns default dose times as minutes since midnight (0–1439).
 * Respects meal timing (a confirmed empty-stomach instruction shifts the morning
 * dose to 07:00; an unspecified meal relation uses the standard 09:00 slot).
 * PRN / SOS returns [] (never schedule doses for PRN).
 */
export function defaultDoseTimes(
  code: FrequencyCode | null,
  withFood?: boolean | null,
  rawFrequency?: string | null
): number[] {
  if (!code) return [];
  const morningMinutes = morningDoseMinutes(withFood);

  // If exact 3-slot pattern is provided (e.g. 1+0+1), assign morning + night
  if (rawFrequency) {
    const norm = normalizeDigits(rawFrequency.trim()).replace(/[><|]/g, '1');
    const slot3 = norm.match(/^(\d+)\s*[+\-x/\\.]\s*(\d+)\s*[+\-x/\\.]\s*(\d+)$/);
    if (slot3) {
      const d1 = parseInt(slot3[1] || '0', 10);
      const d2 = parseInt(slot3[2] || '0', 10);
      const d3 = parseInt(slot3[3] || '0', 10);

      // Morning + Night (1+0+1)
      if (d1 > 0 && d2 === 0 && d3 > 0) {
        return [morningMinutes, 1320];
      }
      // Morning + Afternoon (1+1+0)
      if (d1 > 0 && d2 > 0 && d3 === 0) {
        return [morningMinutes, 840];
      }
      // Afternoon + Night (0+1+1)
      if (d1 === 0 && d2 > 0 && d3 > 0) {
        return [840, 1320];
      }
      // Morning only (1+0+0)
      if (d1 > 0 && d2 === 0 && d3 === 0) {
        return [morningMinutes];
      }
      // Night only (0+0+1)
      if (d1 === 0 && d2 === 0 && d3 > 0) {
        return [1320];
      }
    }
  }

  switch (code) {
    case 'OD':
      return [morningMinutes];
    case 'BD':
      return [morningMinutes, 1260];
    case 'TDS':
      return [480, 840, 1200];
    case 'QID':
      return [480, 720, 960, 1200];
    case 'QHS':
      return [1320];
    case 'STAT':
      return [morningMinutes];
    case 'WEEKLY':
      return [morningMinutes];
    case 'PRN':
    case 'SOS':
      return [];
    case 'CUSTOM':
      return [morningMinutes];
    default:
      return [];
  }
}

/**
 * Returns human-readable description of frequency code.
 */
export function frequencyDescription(code: FrequencyCode | null): string {
  if (!code) return 'Custom / As needed';
  switch (code) {
    case 'OD':
      return 'Once daily (OD)';
    case 'BD':
      return 'Twice daily (BD)';
    case 'TDS':
      return 'Three times daily (TDS)';
    case 'QID':
      return 'Four times daily (QID)';
    case 'QHS':
      return 'Night at bedtime (QHS)';
    case 'PRN':
    case 'SOS':
      return 'As needed (PRN)';
    case 'STAT':
      return 'Immediately (STAT)';
    case 'WEEKLY':
      return 'Once weekly';
    case 'CUSTOM':
      return 'Custom frequency';
  }
}
