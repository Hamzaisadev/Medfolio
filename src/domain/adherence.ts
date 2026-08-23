/**
 * Adherence Calculation & Tracking.
 *
 * Implements adherence calculations per 06-DOMAIN-RULES.md §Adherence:
 * - A pending dose >4 hours (240 minutes) past scheduled time is derived as 'missed' on read.
 * - Future pending doses are excluded from the denominator (a day that hasn't happened cannot lower adherence).
 * - PRN medicines are excluded from adherence calculations entirely.
 * - Percentage = Math.round((taken / scheduled) * 100)
 */

import { addDaysAppTz, minutesInAppTz, todayInAppTz } from '../lib/time';

/**
 * A pending dose becomes 'missed' once it is this many minutes past its
 * scheduled time (06-DOMAIN-RULES.md §Adherence).
 */
export const MISSED_AFTER_MINUTES = 240;

export interface DoseRecord {
  id: string;
  medicine_id: string;
  scheduled_date: string; // 'YYYY-MM-DD'
  scheduled_minutes: number; // 0–1439
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  taken_at?: string | null;
  is_prn?: boolean;
}

export interface AdherenceStats {
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  percentage: number;
}

/**
 * Derives current effective status of a dose at runtime without modifying database.
 * If status is pending and >4 hours (240m) overdue or from a past date, derives 'missed'.
 */
export function deriveStatusOnRead(
  dose: {
    status: 'pending' | 'taken' | 'skipped' | 'missed';
    scheduled_date: string;
    scheduled_minutes: number;
  },
  now: Date
): 'pending' | 'taken' | 'skipped' | 'missed' {
  // A stored 'missed' is a recorded fact and must not be downgraded to pending.
  if (dose.status === 'taken' || dose.status === 'skipped' || dose.status === 'missed') {
    return dose.status;
  }

  const today = todayInAppTz(now);

  if (dose.scheduled_date < today) {
    return 'missed';
  }
  if (dose.scheduled_date === today) {
    if (minutesInAppTz(now) - dose.scheduled_minutes > MISSED_AFTER_MINUTES) {
      return 'missed';
    }
  }
  return 'pending';
}

/**
 * Calculates adherence statistics for a set of dose records over a date range.
 */
export function calculateAdherence(
  doses: DoseRecord[],
  range: { from: string; to: string },
  now: Date
): AdherenceStats {
  let scheduled = 0;
  let taken = 0;
  let skipped = 0;
  let missed = 0;

  for (const dose of doses) {
    // 1. Exclude PRN doses
    if (dose.is_prn) {
      continue;
    }

    // 2. Filter by date range
    if (dose.scheduled_date < range.from || dose.scheduled_date > range.to) {
      continue;
    }

    // 3. Resolve the effective status once, so a stored 'missed' is counted and a
    //    pending-but-overdue dose is derived consistently with the rest of the app.
    //    Previously a stored 'missed' dated today fell through every branch and was
    //    silently dropped from both numerator and denominator.
    const status = deriveStatusOnRead(dose, now);

    if (status === 'taken') {
      scheduled++;
      taken++;
    } else if (status === 'skipped') {
      scheduled++;
      skipped++;
    } else if (status === 'missed') {
      scheduled++;
      missed++;
    }
    // status === 'pending': still actionable (today, within the grace window, or a
    // future date), so it is excluded from the denominator — a day that has not
    // happened yet cannot lower adherence.
  }

  const percentage = scheduled === 0 ? 0 : Math.round((taken / scheduled) * 100);

  return {
    scheduled,
    taken,
    skipped,
    missed,
    percentage,
  };
}

/**
 * Counts consecutive fully-adherent days ending with the most recent day that has
 * a settled outcome.
 *
 * A day counts toward the streak when it had at least one non-PRN dose scheduled
 * and every one of them was taken. Days with no scheduled doses are skipped
 * rather than breaking the streak, and today is only judged once all of its doses
 * have settled — otherwise a morning check-in would reset the streak every day.
 *
 * Replaces the previous dashboard estimate, which derived a "7 day streak" from
 * today's percentage alone and awarded it to users with no doses at all.
 */
export function calculateAdherenceStreak(doses: DoseRecord[], now: Date): number {
  const byDate = new Map<string, { total: number; taken: number; settled: number }>();

  for (const dose of doses) {
    if (dose.is_prn) continue;

    const status = deriveStatusOnRead(dose, now);
    const day = byDate.get(dose.scheduled_date) ?? { total: 0, taken: 0, settled: 0 };
    day.total++;
    if (status === 'taken') {
      day.taken++;
      day.settled++;
    } else if (status === 'skipped' || status === 'missed') {
      day.settled++;
    }
    byDate.set(dose.scheduled_date, day);
  }

  // Walk backwards one calendar day at a time until we pass the oldest day on
  // record. The bound has to be the date *span*, not `byDate.size`: with a gap in
  // the history the span exceeds the number of dosing days, and bounding by the
  // count stopped the walk early and truncated the streak.
  const earliestDate = [...byDate.keys()].sort()[0];
  if (!earliestDate) return 0;

  const today = todayInAppTz(now);
  let streak = 0;
  let cursor = today;

  while (cursor >= earliestDate) {
    const day = byDate.get(cursor);

    if (day) {
      const isSettled = day.settled === day.total;
      const isPerfect = day.taken === day.total;

      if (cursor === today && !isSettled) {
        // Today is still in progress: don't count it, don't break the streak.
      } else if (isPerfect) {
        streak++;
      } else {
        break;
      }
    }

    cursor = addDaysAppTz(cursor, -1);
  }

  return streak;
}
