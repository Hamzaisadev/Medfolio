import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { getLocalItems, insertLocalItem, updateLocalItem, newId } from './localStore';

export type ReminderSettings = Tables<'reminder_settings'>;
export type ReminderSettingsInsert = InsertTables<'reminder_settings'>;
export type ReminderSettingsUpdate = UpdateTables<'reminder_settings'>;

/** Defaults applied when a profile has no saved reminder settings yet. */
export const REMINDER_DEFAULTS = {
  enabled: true,
  quiet_hours_start: 1320, // 22:00
  quiet_hours_end: 420, // 07:00
  snooze_minutes: 15,
  lead_minutes: 0,
} as const;

function defaultsFor(profileId: string, userId: string): ReminderSettings {
  const nowIso = new Date().toISOString();
  return {
    id: newId(),
    user_id: userId,
    profile_id: profileId,
    ...REMINDER_DEFAULTS,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Returns this profile's reminder settings, falling back to defaults.
 *
 * The local fallback matches on `profile_id` exactly — the previous `!r.profile_id ||`
 * clause let one profile's quiet hours apply to another family member.
 */
export async function getReminderSettings(
  profileId: string,
  userId: string = profileId
): Promise<ReminderSettings> {
  try {
    const { data, error } = await supabase
      .from('reminder_settings')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
    return defaultsFor(profileId, userId);
  } catch (err) {
    console.warn('getReminderSettings failed, falling back to local store:', err);
    const local = getLocalItems<ReminderSettings>('reminder_settings');
    return local.find((r) => r.profile_id === profileId) ?? defaultsFor(profileId, userId);
  }
}

export async function upsertReminderSettings(
  settings: ReminderSettingsInsert
): Promise<ReminderSettings> {
  try {
    const { data, error } = await supabase
      .from('reminder_settings')
      .upsert(settings, { onConflict: 'profile_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('upsertReminderSettings failed, saving to local store:', err);
  }

  const local = getLocalItems<ReminderSettings>('reminder_settings');
  const existing = local.find((r) => r.profile_id === settings.profile_id);

  if (existing) {
    return (
      updateLocalItem<ReminderSettings>(
        'reminder_settings',
        existing.id,
        settings as Partial<ReminderSettings>
      ) ?? ({ ...existing, ...settings } as ReminderSettings)
    );
  }

  return insertLocalItem<ReminderSettings>('reminder_settings', {
    ...defaultsFor(settings.profile_id ?? '', settings.user_id ?? ''),
    ...settings,
  } as ReminderSettings);
}
