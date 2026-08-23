/**
 * Time and Date Utilities for Medfolio.
 *
 * CRITICAL RULE:
 * Pakistan is UTC+05:00 with no daylight saving.
 * Naive use of `new Date().toISOString().split('T')[0]` yields yesterday's date
 * for the first five hours of every Pakistani day (00:00 - 04:59 PKT).
 *
 * All date conversions must pass through this file.
 */

export const APP_TIMEZONE = 'Asia/Karachi';

/**
 * Returns today's calendar date as 'YYYY-MM-DD' in the application timezone (PKT).
 * Takes an explicit `now` parameter to enable deterministic unit testing.
 */
export function todayInAppTz(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Returns the current time of day in the app timezone, as minutes since midnight (0–1439).
 *
 * Derived from `Intl` rather than by adding a fixed UTC offset, so it stays
 * correct if APP_TIMEZONE ever changes to a zone that observes DST, and cannot
 * drift out of step with `todayInAppTz`.
 */
export function minutesInAppTz(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  // 'en-GB' renders midnight as 24:00 in some ICU versions.
  return ((hour % 24) * 60 + minute) % 1440;
}

/**
 * Formats a Date object into 'YYYY-MM-DD' in the app timezone.
 */
export function toAppDate(date: Date): string {
  return todayInAppTz(date);
}

/**
 * Parses a 'YYYY-MM-DD' date string into a Date object anchored at 00:00:00 in UTC.
 */
export function fromAppDate(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

/**
 * Adds or subtracts days from a 'YYYY-MM-DD' date string in calendar days.
 */
export function addDaysAppTz(dateStr: string, days: number): string {
  const d = fromAppDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Formats minutes since midnight (0–1439) into a 12-hour display string (e.g. "09:00 AM", "09:30 PM").
 */
export function formatDoseTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const hh = String(hours12).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  return `${hh}:${mm} ${period}`;
}

/**
 * Formats minutes since midnight into 24-hour HH:mm string.
 */
export function formatMinutesTo24h(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Parses a time string (e.g. "09:00", "21:30", "9:00 AM", "09:00 PM") into minutes since midnight (0–1439).
 * Returns null if the format is invalid.
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toLowerCase();

  // Match 12-hour format e.g. "9:30 am", "09:30pm", "9 am", "9pm"
  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    const rawHours = match12[1];
    const rawMins = match12[2];
    const period = match12[3];
    if (!rawHours || !period) return null;

    let h = parseInt(rawHours, 10);
    const m = rawMins ? parseInt(rawMins, 10) : 0;
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;

    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  // Match 24-hour format e.g. "09:00", "21:30", "9:30"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const rawHours = match24[1];
    const rawMins = match24[2];
    if (!rawHours || !rawMins) return null;

    const h = parseInt(rawHours, 10);
    const m = parseInt(rawMins, 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  return null;
}

/* ---------------------------------------------------------------------------
   Display formatting.

   A 'YYYY-MM-DD' string is a storage format, not something to show a patient.
   These were missing, so 20 places across the UI rendered raw ISO dates like
   "2026-08-16" — including the schedule screen's own heading.

   All of them format the calendar date as written, without re-interpreting it in
   the viewer's local zone: `fromAppDate` anchors the string at UTC midnight and
   these read it back in UTC, so "2026-08-16" is always the 16th regardless of
   where the browser is.
   --------------------------------------------------------------------------- */

function formatWith(dateStr: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(
      fromAppDate(dateStr)
    );
  } catch {
    // An unparseable value is better shown verbatim than as "Invalid Date".
    return dateStr;
  }
}

/** "16 August 2026" */
export function formatDateLong(dateStr: string): string {
  return formatWith(dateStr, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "16 Aug 2026" */
export function formatDateMedium(dateStr: string): string {
  return formatWith(dateStr, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "16 Aug" — for dense lists where the year is implied by context. */
export function formatDateShort(dateStr: string): string {
  return formatWith(dateStr, { day: 'numeric', month: 'short' });
}

/** "Sunday" */
export function formatDayName(dateStr: string): string {
  return formatWith(dateStr, { weekday: 'long' });
}

/** "Sun" */
export function formatDayNameShort(dateStr: string): string {
  return formatWith(dateStr, { weekday: 'short' });
}

/** Day of the month with no padding, for a date strip: "16". */
export function formatDayOfMonth(dateStr: string): string {
  return formatWith(dateStr, { day: 'numeric' });
}

/**
 * "Today" / "Yesterday" / "Tomorrow", a weekday name inside the coming or past
 * week, and an absolute date beyond that.
 *
 * Relative labels are anchored to today in PKT, not to the browser's timezone —
 * otherwise a user in another zone could see "Tomorrow" for a dose that is due
 * today in Pakistan.
 */
export function formatRelativeDay(dateStr: string, now: Date = new Date()): string {
  const today = todayInAppTz(now);
  if (dateStr === today) return 'Today';
  if (dateStr === addDaysAppTz(today, -1)) return 'Yesterday';
  if (dateStr === addDaysAppTz(today, 1)) return 'Tomorrow';

  const diffDays = Math.round(
    (fromAppDate(dateStr).getTime() - fromAppDate(today).getTime()) / 86_400_000
  );
  if (Math.abs(diffDays) <= 6) return formatDayName(dateStr);

  return formatDateMedium(dateStr);
}

/**
 * A heading that names the day and keeps the date visible: "Today · 16 Aug".
 * Used where a relative label alone would be ambiguous when re-read later.
 */
export function formatDayHeading(dateStr: string, now: Date = new Date()): string {
  const relative = formatRelativeDay(dateStr, now);
  const absolute = formatDateShort(dateStr);
  return relative === absolute ? absolute : `${relative} · ${absolute}`;
}

/** True when the date string is today in the app timezone. */
export function isToday(dateStr: string, now: Date = new Date()): boolean {
  return dateStr === todayInAppTz(now);
}

