/**
 * Dose reminder scheduling rules.
 *
 * Pure functions so the timing logic is testable without a browser: the runtime
 * wiring lives in `useDoseReminders`. Previously `reminder_settings` (quiet hours,
 * lead time, snooze) was stored, exported and never read by anything — no
 * reminder was ever delivered.
 */

export interface ReminderPreferences {
  enabled: boolean;
  /** Minutes since midnight; null disables the quiet window. */
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  snooze_minutes: number;
  /** Fire this many minutes before the scheduled time. */
  lead_minutes: number;
}

export interface ReminderCandidate {
  doseId: string;
  medicineName: string;
  scheduledDate: string;
  scheduledMinutes: number;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
  snoozedUntilMinutes?: number | null;
}

export interface DueReminder {
  doseId: string;
  medicineName: string;
  scheduledMinutes: number;
  /** Minutes past the scheduled time; negative when firing early via lead time. */
  minutesLate: number;
}

/** A reminder is not worth firing once the dose is this far past due. */
export const REMINDER_STALE_AFTER_MINUTES = 240;

/**
 * True when `minutes` falls inside the quiet window.
 *
 * Handles windows that wrap midnight (22:00 → 07:00), which is the normal case
 * and would be inverted by a naive `start <= m && m <= end` comparison.
 */
export function isWithinQuietHours(
  minutes: number,
  start: number | null,
  end: number | null
): boolean {
  if (start === null || end === null || start === end) return false;

  return start < end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

/**
 * Selects the doses that should trigger a notification right now.
 *
 * Excludes doses that are already resolved, still in the future (allowing for
 * lead time), snoozed, stale, or that fall inside quiet hours.
 */
export function selectDueReminders(
  candidates: ReminderCandidate[],
  preferences: ReminderPreferences,
  nowMinutes: number,
  today: string,
  alreadyNotified: ReadonlySet<string> = new Set()
): DueReminder[] {
  if (!preferences.enabled) return [];
  if (isWithinQuietHours(nowMinutes, preferences.quiet_hours_start, preferences.quiet_hours_end)) {
    return [];
  }

  const due: DueReminder[] = [];

  for (const candidate of candidates) {
    if (candidate.status !== 'pending') continue;
    if (candidate.scheduledDate !== today) continue;
    if (alreadyNotified.has(candidate.doseId)) continue;

    if (
      candidate.snoozedUntilMinutes !== null &&
      candidate.snoozedUntilMinutes !== undefined &&
      nowMinutes < candidate.snoozedUntilMinutes
    ) {
      continue;
    }

    const fireAt = candidate.scheduledMinutes - Math.max(0, preferences.lead_minutes);
    if (nowMinutes < fireAt) continue;

    const minutesLate = nowMinutes - candidate.scheduledMinutes;
    if (minutesLate > REMINDER_STALE_AFTER_MINUTES) continue;

    due.push({
      doseId: candidate.doseId,
      medicineName: candidate.medicineName,
      scheduledMinutes: candidate.scheduledMinutes,
      minutesLate,
    });
  }

  return due.sort((a, b) => a.scheduledMinutes - b.scheduledMinutes);
}

/** Body text for a due reminder. */
export function reminderBody(reminder: DueReminder, formatTime: (m: number) => string): string {
  if (reminder.minutesLate < 0) {
    return `Due at ${formatTime(reminder.scheduledMinutes)} — coming up shortly.`;
  }
  if (reminder.minutesLate < 5) {
    return `It's time for your ${formatTime(reminder.scheduledMinutes)} dose.`;
  }
  return `Your ${formatTime(reminder.scheduledMinutes)} dose is still marked as pending.`;
}
