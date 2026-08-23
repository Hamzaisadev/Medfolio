import { useEffect, useRef } from 'react';
import { dosesRepo, medicinesRepo, remindersRepo } from '../db';
import {
  selectDueReminders,
  reminderBody,
  type ReminderCandidate,
  type ReminderPreferences,
} from '../../domain/reminders';
import { formatDoseTime, minutesInAppTz, todayInAppTz } from '../time';
import { notificationPermission, sendLocalNotification } from './index';

const POLL_INTERVAL_MS = 60_000;

/**
 * Delivers dose reminders while the app is open.
 *
 * This is the wiring that was missing entirely: `reminder_settings` and the
 * notification helpers both existed, but nothing ever connected them, so the app
 * never reminded anyone about a dose.
 *
 * Scope: foreground only. Reminders stop when the tab is closed — true background
 * delivery needs push subscriptions and a server, which is a separate change.
 */
export function useDoseReminders(profileId: string, userId: string): void {
  // Per-dose dedupe so a dose is announced once, not every poll.
  const notifiedRef = useRef<Set<string>>(new Set());
  const notifiedDayRef = useRef<string>('');

  useEffect(() => {
    if (!profileId) return;
    if (notificationPermission() !== 'granted') return;

    let cancelled = false;

    async function tick() {
      try {
        const today = todayInAppTz();

        // Reset the dedupe set when the day rolls over.
        if (notifiedDayRef.current !== today) {
          notifiedDayRef.current = today;
          notifiedRef.current = new Set();
        }

        const [settings, doses, medicines] = await Promise.all([
          remindersRepo.getReminderSettings(profileId, userId),
          dosesRepo.listDosesForDate(profileId, today),
          medicinesRepo.listMedicines(profileId),
        ]);

        if (cancelled || !settings.enabled) return;

        const nameById = new Map(medicines.map((m) => [m.id, m.medicine_name]));

        const preferences: ReminderPreferences = {
          enabled: settings.enabled,
          quiet_hours_start: settings.quiet_hours_start,
          quiet_hours_end: settings.quiet_hours_end,
          snooze_minutes: settings.snooze_minutes,
          lead_minutes: settings.lead_minutes,
        };

        const candidates: ReminderCandidate[] = doses.map((d) => ({
          doseId: d.id,
          medicineName: nameById.get(d.medicine_id) ?? 'your medicine',
          scheduledDate: d.scheduled_date,
          scheduledMinutes: d.scheduled_minutes,
          status: d.status,
          snoozedUntilMinutes: d.snoozed_until ? minutesInAppTz(new Date(d.snoozed_until)) : null,
        }));

        const due = selectDueReminders(
          candidates,
          preferences,
          minutesInAppTz(),
          today,
          notifiedRef.current
        );

        for (const reminder of due) {
          if (cancelled) return;
          const shown = await sendLocalNotification(`Time for ${reminder.medicineName}`, {
            body: reminderBody(reminder, formatDoseTime),
            tag: `dose-${reminder.doseId}`,
          });
          // Only mark as notified if it actually displayed, so a transient
          // failure does not permanently suppress the reminder.
          if (shown) {
            notifiedRef.current.add(reminder.doseId);
          }
        }
      } catch (err) {
        console.warn('Dose reminder check failed:', err);
      }
    }

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profileId, userId]);
}
