/**
 * Clinical Duration Parsing.
 *
 * Implements duration conversion per 06-DOMAIN-RULES.md:
 * - Return 'unknown' when unclear (NEVER default).
 * - Match number anchored to time unit (e.g. "1 tablet for 5 days" -> 5 days, not 1).
 * - End date formula: end_date = start_date + duration_days - 1.
 */

import { addDaysAppTz } from '../lib/time';

export type DurationResult =
  | { kind: 'days'; days: number }
  | { kind: 'ongoing' }
  | { kind: 'unknown' };

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses written prescription duration into days, ongoing flag, or unknown.
 */
export function parseDuration(raw: string | null | undefined): DurationResult {
  if (!raw) return { kind: 'unknown' };
  const input = normalize(raw);
  if (!input) return { kind: 'unknown' };

  // 1. Check for "till review" / "follow up" / uncertain phrasings
  if (
    input.includes('till review') ||
    input.includes('until review') ||
    input.includes('until follow') ||
    input.includes('till follow') ||
    input.includes('review ke baad') ||
    input.includes('doctor ke kehne tak')
  ) {
    return { kind: 'unknown' };
  }

  // 2. Check for chronic / ongoing phrasings
  if (
    input === 'continue' ||
    input === 'ongoing' ||
    input === 'regular' ||
    input.includes('long term') ||
    input.includes('lifelong') ||
    input.includes('hamesha') ||
    input.includes('chalu') ||
    input.includes('jari')
  ) {
    return { kind: 'ongoing' };
  }

  // 3. Fraction shorthand e.g. "5/7" -> 5 days, "10/7" -> 10 days
  const fractionMatch = raw.match(/\b(\d+)\s*\/\s*7\b/);
  if (fractionMatch && fractionMatch[1]) {
    const days = parseInt(fractionMatch[1], 10);
    if (days > 0) return { kind: 'days', days };
  }

  // 4. "x5" or "x 5" shorthand for days
  const xMatch = raw.match(/\bx\s*(\d+)\b/i);
  if (xMatch && xMatch[1]) {
    const days = parseInt(xMatch[1], 10);
    if (days > 0) return { kind: 'days', days };
  }

  // 5. Unit anchored matches: "N days/din/d"
  const daysMatch = input.match(/\b(\d+)\s*(?:days?|din|d)\b/);
  if (daysMatch && daysMatch[1]) {
    const days = parseInt(daysMatch[1], 10);
    if (days > 0) return { kind: 'days', days };
  }

  // 6. Unit anchored matches: "N weeks/hafte/w/wk"
  const weeksMatch = input.match(/\b(\d+)\s*(?:weeks?|hafte|hafta|wks?|w)\b/);
  if (weeksMatch && weeksMatch[1]) {
    const weeks = parseInt(weeksMatch[1], 10);
    if (weeks > 0) return { kind: 'days', days: weeks * 7 };
  }

  // 7. Unit anchored matches: "N months/mah/m"
  const monthsMatch = input.match(/\b(\d+)\s*(?:months?|mah|maheenay|m)\b/);
  if (monthsMatch && monthsMatch[1]) {
    const months = parseInt(monthsMatch[1], 10);
    if (months > 0) return { kind: 'days', days: months * 30 };
  }

  // 8. Word numbers (e.g. "one week", "two weeks", "five days")
  if (input.includes('one week') || input.includes('1 week') || input.includes('ek hafta')) {
    return { kind: 'days', days: 7 };
  }
  if (input.includes('two weeks') || input.includes('do hafte')) {
    return { kind: 'days', days: 14 };
  }
  if (input.includes('one month') || input.includes('ek mah')) {
    return { kind: 'days', days: 30 };
  }

  return { kind: 'unknown' };
}

/**
 * Calculates end date in YYYY-MM-DD from start date and duration days.
 * Formula: end_date = start_date + duration_days - 1.
 * (A 5-day course starting Monday 2026-08-17 ends Friday 2026-08-21).
 */
export function computeEndDate(startDate: string, durationDays: number): string {
  if (durationDays <= 0) return startDate;
  return addDaysAppTz(startDate, durationDays - 1);
}
