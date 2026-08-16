/**
 * Adherence Calculation & Tracking.
 *
 * Implements adherence calculations per 06-DOMAIN-RULES.md §Adherence:
 * - A pending dose >4 hours (240 minutes) past scheduled time is derived as 'missed' on read.
 * - Future pending doses are excluded from the denominator (a day that hasn't happened cannot lower adherence).
 * - PRN medicines are excluded from adherence calculations entirely.
 * - Percentage = Math.round((taken / scheduled) * 100)
 */

import { todayInAppTz } from '../lib/time';

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
  if (dose.status === 'taken' || dose.status === 'skipped') {
    return dose.status;
  }
  const today = todayInAppTz(now);
  const nowUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowPktMinutes = (nowUtcMinutes + 300) % 1440;

  if (dose.scheduled_date < today) {
    return 'missed';
  }
  if (dose.scheduled_date === today) {
    const minutesPast = nowPktMinutes - dose.scheduled_minutes;
    if (minutesPast > 240) {
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
  const today = todayInAppTz(now);
  const nowUtcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowPktMinutes = (nowUtcMinutes + 300) % 1440;

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

    if (dose.status === 'taken') {
      scheduled++;
      taken++;
      continue;
    }

    if (dose.status === 'skipped') {
      scheduled++;
      skipped++;
      continue;
    }

    // Status is 'pending': check if it is in the past, today overdue (>4 hrs), or in the future
    if (dose.scheduled_date < today) {
      // Past day pending dose -> derived missed
      scheduled++;
      missed++;
    } else if (dose.scheduled_date === today) {
      const minutesPast = nowPktMinutes - dose.scheduled_minutes;
      if (minutesPast > 240) {
        // > 4 hours overdue on current day -> derived missed
        scheduled++;
        missed++;
      }
      // If <= 4 hours or upcoming today, it is still pending, not counted in past scheduled denominator yet
    }
    // If dose.scheduled_date > today, it is a future scheduled dose -> excluded from denominator
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
