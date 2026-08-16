/**
 * Dose Schedule Generation.
 *
 * Implements schedule expansion per 06-DOMAIN-RULES.md:
 * - Generates dose rows given startDate, duration, isOngoing, and doseTimes.
 * - Injects `now: Date` explicitly for deterministic timezone handling.
 * - PRN / empty doseTimes generates NO rows.
 * - Null duration on non-ongoing medicine generates NO rows.
 * - Ongoing medicines generate 30 days forward.
 * - Fixed durations generate exactly `durationDays` worth of doses.
 * - Dosing interval is honoured: WEEKLY repeats every 7th day, STAT produces a
 *   single dose. Expanding those daily is a dosing error, not a display quirk.
 */

import { addDaysAppTz } from '../lib/time';
import type { FrequencyCode } from './frequency';

export interface ScheduleGenerationInput {
  medicineId: string;
  startDate: string; // 'YYYY-MM-DD'
  durationDays: number | null;
  isOngoing: boolean;
  doseTimes: number[]; // array of minutes since midnight, e.g. [540, 1260]
  now: Date; // injected clock
  /**
   * Frequency code, when known. Controls the repeat interval:
   * WEEKLY → every 7 days, STAT → one dose only, everything else → daily.
   * Omitted or null is treated as daily, matching the doseTimes contract.
   */
  frequencyCode?: FrequencyCode | null;
}

export interface ScheduledDoseItem {
  scheduled_date: string;
  scheduled_minutes: number;
}

const MAX_DURATION_DAYS = 365;
const ONGOING_HORIZON_DAYS = 30;

/**
 * Days between consecutive dosing days for a frequency code.
 * Codes that describe several doses *within* one day (BD/TDS/QID) still dose
 * every day — their multiplicity lives in `doseTimes`, not in this interval.
 */
function dayIntervalFor(code: FrequencyCode | null | undefined): number {
  return code === 'WEEKLY' ? 7 : 1;
}

/** True when the code means "one dose, once" rather than a repeating course. */
function isSingleDose(code: FrequencyCode | null | undefined): boolean {
  return code === 'STAT';
}

export function buildSchedule(input: ScheduleGenerationInput): ScheduledDoseItem[] {
  const { startDate, durationDays, isOngoing, doseTimes, frequencyCode } = input;

  // 1. If no dose times provided (e.g. PRN/SOS), generate zero doses
  if (!doseTimes || doseTimes.length === 0) {
    return [];
  }

  // 2. A single immediate dose never repeats, whatever the duration says.
  if (isSingleDose(frequencyCode)) {
    const firstTime = doseTimes[0];
    return firstTime === undefined
      ? []
      : [{ scheduled_date: startDate, scheduled_minutes: firstTime }];
  }

  // 3. If non-ongoing and durationDays is null or <= 0, generate zero doses
  if (!isOngoing && (durationDays === null || durationDays <= 0)) {
    return [];
  }

  const daysToCover = isOngoing
    ? ONGOING_HORIZON_DAYS
    : Math.min(durationDays as number, MAX_DURATION_DAYS);

  const interval = dayIntervalFor(frequencyCode);
  const results: ScheduledDoseItem[] = [];

  for (let dayOffset = 0; dayOffset < daysToCover; dayOffset += interval) {
    const scheduledDate = addDaysAppTz(startDate, dayOffset);
    for (const minutes of doseTimes) {
      results.push({
        scheduled_date: scheduledDate,
        scheduled_minutes: minutes,
      });
    }
  }

  return results;
}
