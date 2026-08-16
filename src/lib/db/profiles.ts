import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { getLocalItems, insertLocalItem, updateLocalItem } from './localStore';
import { listWithFallback } from './offlineFallback';

export type Profile = Tables<'profiles'>;
export type ProfileInsert = InsertTables<'profiles'>;
export type ProfileUpdate = UpdateTables<'profiles'>;

function blankProfile(userId: string): Profile {
  const nowIso = new Date().toISOString();
  return {
    id: userId,
    user_id: userId,
    full_name: 'Patient',
    relationship: 'self',
    date_of_birth: null,
    sex: 'undisclosed',
    blood_group: 'unknown',
    height_cm: null,
    weight_kg: null,
    allergies: null,
    chronic_conditions: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    is_default: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Returns the user's default profile, or null if they do not have one yet.
 *
 * Returning null is meaningful: the caller creates the real profile. Previously
 * this fabricated and persisted a local placeholder even when the database was
 * reachable, which masked "this user has no profile" and could shadow the real
 * row once it appeared.
 */
export async function getDefaultProfile(userId: string): Promise<Profile | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ?? null;
  } catch (err) {
    console.warn('getDefaultProfile failed, falling back to local store:', err);
    const local = getLocalItems<Profile>('profiles');
    return local.find((p) => p.user_id === userId) ?? null;
  }
}

export async function listProfiles(userId: string): Promise<Profile[]> {
  return listWithFallback<Profile>(
    'listProfiles',
    'profiles',
    () =>
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    (items) => items.filter((p) => p.user_id === userId)
  );
}

/**
 * Updates a profile, creating it if it does not exist yet.
 *
 * Uses an upsert so a first-time sign-up does not depend on a separate insert
 * path, and so the local fallback carries the same values as the remote row.
 */
export async function updateProfile(id: string, updates: ProfileUpdate): Promise<Profile> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ ...updates, id } as InsertTables<'profiles'>, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('updateProfile failed, updating local store:', err);
  }

  const localUpdated = updateLocalItem<Profile>('profiles', id, updates as Partial<Profile>);
  if (localUpdated) return localUpdated;

  return insertLocalItem<Profile>('profiles', {
    ...blankProfile(updates.user_id || id),
    ...updates,
    id,
  } as Profile);
}
