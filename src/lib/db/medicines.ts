import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { getLocalItems, updateLocalItem, deleteLocalItem, newId } from './localStore';
import { getWithFallback, insertWithFallback, listWithFallback } from './offlineFallback';

export type Medicine = Tables<'medicines'>;
export type MedicineInsert = InsertTables<'medicines'>;
export type MedicineUpdate = UpdateTables<'medicines'>;

export async function listMedicines(profileId: string): Promise<Medicine[]> {
  return listWithFallback<Medicine>(
    'listMedicines',
    'medicines',
    () =>
      supabase
        .from('medicines')
        .select('*')
        .eq('profile_id', profileId)
        .order('start_date', { ascending: false }),
    // Rows with no profile_id are excluded: matching them leaked medicines
    // between family profiles.
    (items) => items.filter((m) => m.profile_id === profileId)
  );
}

export async function getMedicineById(id: string): Promise<Medicine | null> {
  return getWithFallback<Medicine>(
    'getMedicineById',
    'medicines',
    () => supabase.from('medicines').select('*').eq('id', id).maybeSingle(),
    (items) => items.find((m) => m.id === id)
  );
}

export async function createMedicine(medicine: MedicineInsert): Promise<Medicine> {
  // Column defaults are applied to the payload itself, so the remote row and the
  // offline row carry the same values instead of diverging.
  const payload: MedicineInsert = {
    ...medicine,
    currency: medicine.currency || 'PKR',
    is_ongoing: medicine.is_ongoing ?? false,
    is_otc: medicine.is_otc ?? false,
  };

  return insertWithFallback<Medicine>(
    'createMedicine',
    'medicines',
    () => supabase.from('medicines').insert(payload).select().single(),
    () =>
      ({
        ...payload,
        id: payload.id || newId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Medicine
  );
}

export async function updateMedicine(id: string, updates: MedicineUpdate): Promise<Medicine> {
  try {
    const { data, error } = await supabase
      .from('medicines')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('updateMedicine failed, updating local store:', err);
  }

  const localUpdated = updateLocalItem<Medicine>('medicines', id, updates as Partial<Medicine>);
  if (!localUpdated) throw new Error(`No medicine found with id ${id}.`);
  return localUpdated;
}

export async function discontinueMedicine(id: string, discontinuedAt: string): Promise<Medicine> {
  return updateMedicine(id, { discontinued_at: discontinuedAt });
}

export async function deleteMedicine(id: string): Promise<void> {
  const { error } = await supabase.from('medicines').delete().eq('id', id);

  // Delete locally only after the remote delete is known to have succeeded (or
  // to have failed for connectivity reasons), so the two stores stay aligned.
  if (error) {
    throw new Error(`Could not delete this medicine: ${error.message}`);
  }
  deleteLocalItem('medicines', id);
}

/** Exposed for tests and diagnostics. */
export function localMedicines(): Medicine[] {
  return getLocalItems<Medicine>('medicines');
}
