import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { getLocalItems, setLocalItems, updateLocalItem, newId } from './localStore';
import { listWithFallback } from './offlineFallback';

export type Dose = Tables<'doses'>;
export type DoseInsert = InsertTables<'doses'>;
export type DoseUpdate = UpdateTables<'doses'>;

/**
 * Doses belong to a profile. Rows with no `profile_id` are NOT matched: doing so
 * leaked one family member's doses into another member's schedule.
 */
function belongsToProfile(dose: Dose, profileId: string): boolean {
  return dose.profile_id === profileId;
}

export async function listDosesForDate(profileId: string, dateStr: string): Promise<Dose[]> {
  return listWithFallback<Dose>(
    'listDosesForDate',
    'doses',
    () =>
      supabase
        .from('doses')
        .select('*')
        .eq('profile_id', profileId)
        .eq('scheduled_date', dateStr)
        .order('scheduled_minutes', { ascending: true }),
    (items) =>
      items
        .filter((d) => belongsToProfile(d, profileId) && d.scheduled_date === dateStr)
        .sort((a, b) => a.scheduled_minutes - b.scheduled_minutes)
  );
}

export async function listDosesForRange(
  profileId: string,
  startDate: string,
  endDate: string
): Promise<Dose[]> {
  return listWithFallback<Dose>(
    'listDosesForRange',
    'doses',
    () =>
      supabase
        .from('doses')
        .select('*')
        .eq('profile_id', profileId)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date', { ascending: true })
        .order('scheduled_minutes', { ascending: true }),
    (items) =>
      items
        .filter(
          (d) =>
            belongsToProfile(d, profileId) &&
            d.scheduled_date >= startDate &&
            d.scheduled_date <= endDate
        )
        .sort((a, b) =>
          a.scheduled_date !== b.scheduled_date
            ? a.scheduled_date.localeCompare(b.scheduled_date)
            : a.scheduled_minutes - b.scheduled_minutes
        )
  );
}

/**
 * Upserts dose rows, deduplicating on (medicine_id, scheduled_date, scheduled_minutes)
 * to match the unique constraint in migration 0015.
 *
 * Ids are left for Postgres to generate (or created with `newId()` for the offline
 * path). Client-generated string ids such as `dose-1755…` are not valid `uuid`
 * values, so every remote write silently failed and the app ran on localStorage.
 */
export async function createDoses(doses: DoseInsert[]): Promise<Dose[]> {
  if (doses.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('doses')
      .upsert(doses, {
        onConflict: 'medicine_id,scheduled_date,scheduled_minutes',
        ignoreDuplicates: true,
      })
      .select();

    if (error) throw new Error(error.message);
    // `ignoreDuplicates` returns only newly inserted rows, so an empty array
    // here means "all of these already existed" — which is success.
    if (data) return data;
  } catch (err) {
    console.warn('createDoses failed, writing to local store:', err);
  }

  return writeDosesLocally(doses);
}

function writeDosesLocally(doses: DoseInsert[]): Dose[] {
  const currentLocal = getLocalItems<Dose>('doses');
  const nowIso = new Date().toISOString();
  const written: Dose[] = [];

  for (const d of doses) {
    const existing = currentLocal.find(
      (item) =>
        item.medicine_id === d.medicine_id &&
        item.scheduled_date === d.scheduled_date &&
        item.scheduled_minutes === d.scheduled_minutes
    );

    if (existing) {
      written.push(existing);
      continue;
    }

    const newDose: Dose = {
      id: d.id || newId(),
      user_id: d.user_id,
      profile_id: d.profile_id,
      medicine_id: d.medicine_id,
      scheduled_date: d.scheduled_date,
      scheduled_minutes: d.scheduled_minutes,
      status: d.status || 'pending',
      taken_at: d.taken_at || null,
      skipped_reason: d.skipped_reason || null,
      snoozed_until: d.snoozed_until || null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    currentLocal.push(newDose);
    written.push(newDose);
  }

  setLocalItems('doses', currentLocal);
  return written;
}

export async function updateDoseStatus(
  id: string,
  status: 'taken' | 'skipped' | 'pending',
  takenAt?: string | null,
  skippedReason?: string | null
): Promise<Dose> {
  const updates: DoseUpdate = { status };
  if (status === 'taken') {
    updates.taken_at = takenAt || new Date().toISOString();
    updates.skipped_reason = null;
  } else if (status === 'skipped') {
    updates.skipped_reason = skippedReason || null;
    updates.taken_at = null;
  } else {
    updates.taken_at = null;
    updates.skipped_reason = null;
  }

  try {
    const { data, error } = await supabase
      .from('doses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('updateDoseStatus failed, updating local store:', err);
  }

  const localUpdated = updateLocalItem<Dose>('doses', id, updates as Partial<Dose>);
  if (!localUpdated) {
    throw new Error(`Could not record this dose: no dose found with id ${id}.`);
  }
  return localUpdated;
}

/**
 * Deletes still-pending doses from `fromDate` onward, used when a medicine's
 * schedule changes. Taken and skipped doses are preserved as history.
 *
 * Throws if the remote delete fails, and leaves the local store untouched in
 * that case: silently keeping stale future doses would show the patient a
 * schedule their prescription no longer supports.
 */
export async function deleteFuturePendingDoses(
  medicineId: string,
  fromDate: string
): Promise<void> {
  const { error } = await supabase
    .from('doses')
    .delete()
    .eq('medicine_id', medicineId)
    .eq('status', 'pending')
    .gte('scheduled_date', fromDate);

  if (error) {
    throw new Error(`Could not clear the old schedule: ${error.message}`);
  }

  const currentLocal = getLocalItems<Dose>('doses');
  setLocalItems(
    'doses',
    currentLocal.filter(
      (d) => !(d.medicine_id === medicineId && d.status === 'pending' && d.scheduled_date >= fromDate)
    )
  );
}
