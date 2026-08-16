import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { deleteLocalItem, newId } from './localStore';
import { insertWithFallback, listWithFallback } from './offlineFallback';

export type SideEffect = Tables<'side_effects'>;
export type SideEffectInsert = InsertTables<'side_effects'>;
export type SideEffectUpdate = UpdateTables<'side_effects'>;

export async function listSideEffects(
  profileId: string,
  medicineId?: string
): Promise<SideEffect[]> {
  return listWithFallback<SideEffect>(
    'listSideEffects',
    'side_effects',
    () => {
      let query = supabase
        .from('side_effects')
        .select('*')
        .eq('profile_id', profileId)
        .order('occurred_at', { ascending: false });

      if (medicineId) {
        query = query.eq('medicine_id', medicineId);
      }
      return query;
    },
    (items) =>
      items.filter(
        (s) => s.profile_id === profileId && (!medicineId || s.medicine_id === medicineId)
      )
  );
}

export async function createSideEffect(effect: SideEffectInsert): Promise<SideEffect> {
  const payload: SideEffectInsert = {
    ...effect,
    occurred_at: effect.occurred_at || new Date().toISOString(),
  };

  return insertWithFallback<SideEffect>(
    'createSideEffect',
    'side_effects',
    () => supabase.from('side_effects').insert(payload).select().single(),
    () =>
      ({
        ...payload,
        id: payload.id || newId(),
        created_at: new Date().toISOString(),
      }) as SideEffect
  );
}

export async function deleteSideEffect(id: string): Promise<void> {
  const { error } = await supabase.from('side_effects').delete().eq('id', id);
  if (error) {
    throw new Error(`Could not delete this side effect: ${error.message}`);
  }
  deleteLocalItem('side_effects', id);
}
