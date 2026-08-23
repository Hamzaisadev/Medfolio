import { describe, it, expect } from 'vitest';
import {
  isWithinQuietHours,
  selectDueReminders,
  reminderBody,
  REMINDER_STALE_AFTER_MINUTES,
  type ReminderCandidate,
  type ReminderPreferences,
} from '../reminders';
import { formatDoseTime } from '../../lib/time';

const prefs = (overrides: Partial<ReminderPreferences> = {}): ReminderPreferences => ({
  enabled: true,
  quiet_hours_start: 1320, // 22:00
  quiet_hours_end: 420, // 07:00
  snooze_minutes: 15,
  lead_minutes: 0,
  ...overrides,
});

const candidate = (overrides: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  doseId: 'd1',
  medicineName: 'Metformin',
  scheduledDate: '2026-08-15',
  scheduledMinutes: 540, // 09:00
  status: 'pending',
  ...overrides,
});

const TODAY = '2026-08-15';

describe('isWithinQuietHours', () => {
  it('handles a window that wraps midnight', () => {
    // 22:00 → 07:00, the default. A naive start<=m<=end comparison inverts this.
    expect(isWithinQuietHours(1380, 1320, 420)).toBe(true); // 23:00
    expect(isWithinQuietHours(60, 1320, 420)).toBe(true); // 01:00
    expect(isWithinQuietHours(419, 1320, 420)).toBe(true); // 06:59
    expect(isWithinQuietHours(420, 1320, 420)).toBe(false); // 07:00 — window ends
    expect(isWithinQuietHours(720, 1320, 420)).toBe(false); // 12:00
    expect(isWithinQuietHours(1319, 1320, 420)).toBe(false); // 21:59
  });

  it('handles a same-day window', () => {
    expect(isWithinQuietHours(780, 720, 840)).toBe(true); // 13:00 in 12:00–14:00
    expect(isWithinQuietHours(900, 720, 840)).toBe(false);
  });

  it('treats a null or zero-length window as no quiet hours', () => {
    expect(isWithinQuietHours(60, null, 420)).toBe(false);
    expect(isWithinQuietHours(60, 1320, null)).toBe(false);
    expect(isWithinQuietHours(60, 420, 420)).toBe(false);
  });
});

describe('selectDueReminders', () => {
  it('fires for a pending dose whose time has arrived', () => {
    const due = selectDueReminders([candidate()], prefs(), 540, TODAY);
    expect(due).toHaveLength(1);
    expect(due[0]?.doseId).toBe('d1');
    expect(due[0]?.minutesLate).toBe(0);
  });

  it('does not fire before the dose is due', () => {
    expect(selectDueReminders([candidate()], prefs(), 539, TODAY)).toHaveLength(0);
  });

  it('honours lead_minutes by firing early', () => {
    const due = selectDueReminders([candidate()], prefs({ lead_minutes: 15 }), 525, TODAY);
    expect(due).toHaveLength(1);
    expect(due[0]?.minutesLate).toBe(-15);
  });

  it('suppresses everything during quiet hours', () => {
    // 23:00 dose at 23:00, inside the 22:00–07:00 window.
    const nightDose = candidate({ scheduledMinutes: 1380 });
    expect(selectDueReminders([nightDose], prefs(), 1380, TODAY)).toHaveLength(0);
  });

  it('suppresses everything when reminders are disabled', () => {
    expect(selectDueReminders([candidate()], prefs({ enabled: false }), 540, TODAY)).toHaveLength(0);
  });

  it('skips doses that are already resolved', () => {
    for (const status of ['taken', 'skipped', 'missed'] as const) {
      expect(selectDueReminders([candidate({ status })], prefs(), 600, TODAY), status).toHaveLength(0);
    }
  });

  it('skips a dose that is snoozed until later', () => {
    const snoozed = candidate({ snoozedUntilMinutes: 600 });
    expect(selectDueReminders([snoozed], prefs(), 560, TODAY)).toHaveLength(0);
    expect(selectDueReminders([snoozed], prefs(), 600, TODAY)).toHaveLength(1);
  });

  it('stops nagging once a dose is stale', () => {
    const late = 540 + REMINDER_STALE_AFTER_MINUTES;
    expect(selectDueReminders([candidate()], prefs(), late, TODAY)).toHaveLength(1);
    expect(selectDueReminders([candidate()], prefs(), late + 1, TODAY)).toHaveLength(0);
  });

  it('skips doses for other dates', () => {
    expect(
      selectDueReminders([candidate({ scheduledDate: '2026-08-14' })], prefs(), 540, TODAY)
    ).toHaveLength(0);
  });

  it('does not repeat a dose that was already notified', () => {
    expect(
      selectDueReminders([candidate()], prefs(), 540, TODAY, new Set(['d1']))
    ).toHaveLength(0);
  });

  it('returns due reminders in schedule order', () => {
    // Both doses must sit inside the staleness window at the evaluation time,
    // otherwise this would be re-testing staleness instead of ordering: at 20:00
    // an 09:00 dose is 11 hours late and is correctly dropped.
    const due = selectDueReminders(
      [
        candidate({ doseId: 'evening', scheduledMinutes: 1200 }), // 20:00
        candidate({ doseId: 'afternoon', scheduledMinutes: 1080 }), // 18:00
      ],
      prefs(),
      1200,
      TODAY
    );
    expect(due.map((d) => d.doseId)).toEqual(['afternoon', 'evening']);
  });
});

describe('reminderBody', () => {
  it('describes an upcoming, current and overdue dose differently', () => {
    expect(reminderBody({ doseId: 'a', medicineName: 'X', scheduledMinutes: 540, minutesLate: -15 }, formatDoseTime))
      .toMatch(/coming up/i);
    expect(reminderBody({ doseId: 'a', medicineName: 'X', scheduledMinutes: 540, minutesLate: 0 }, formatDoseTime))
      .toMatch(/it's time/i);
    expect(reminderBody({ doseId: 'a', medicineName: 'X', scheduledMinutes: 540, minutesLate: 90 }, formatDoseTime))
      .toMatch(/still marked as pending/i);
  });
});
