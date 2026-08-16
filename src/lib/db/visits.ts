import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { updateLocalItem, deleteLocalItem, newId } from './localStore';
import { getWithFallback, insertWithFallback, listWithFallback } from './offlineFallback';

export type Visit = Tables<'visits'>;
export type VisitInsert = InsertTables<'visits'>;
export type VisitUpdate = UpdateTables<'visits'>;
export type VisitImage = Tables<'visit_images'>;

export async function listVisits(profileId: string): Promise<Visit[]> {
  return listWithFallback<Visit>(
    'listVisits',
    'visits',
    () =>
      supabase
        .from('visits')
        .select('*')
        .eq('profile_id', profileId)
        .order('visit_date', { ascending: false }),
    (items) => items.filter((v) => v.profile_id === profileId)
  );
}

export async function getVisitById(id: string): Promise<Visit | null> {
  return getWithFallback<Visit>(
    'getVisitById',
    'visits',
    () => supabase.from('visits').select('*').eq('id', id).maybeSingle(),
    (items) => items.find((v) => v.id === id)
  );
}

export async function createVisit(visit: VisitInsert): Promise<Visit> {
  const payload: VisitInsert = { ...visit, currency: visit.currency || 'PKR' };

  return insertWithFallback<Visit>(
    'createVisit',
    'visits',
    () => supabase.from('visits').insert(payload).select().single(),
    () =>
      ({
        ...payload,
        id: payload.id || newId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Visit
  );
}

export async function updateVisit(id: string, updates: VisitUpdate): Promise<Visit> {
  try {
    const { data, error } = await supabase
      .from('visits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn('updateVisit failed, updating local store:', err);
  }

  const localUpdated = updateLocalItem<Visit>('visits', id, updates as Partial<Visit>);
  if (!localUpdated) throw new Error(`No visit found with id ${id}.`);
  return localUpdated;
}

export async function deleteVisit(id: string): Promise<void> {
  const { error } = await supabase.from('visits').delete().eq('id', id);
  if (error) {
    throw new Error(`Could not delete this visit: ${error.message}`);
  }
  deleteLocalItem('visits', id);
}

export async function addVisitImage(image: InsertTables<'visit_images'>): Promise<VisitImage> {
  const payload = { ...image, page_number: image.page_number || 1 };

  return insertWithFallback<VisitImage>(
    'addVisitImage',
    'visit_images',
    () => supabase.from('visit_images').insert(payload).select().single(),
    () =>
      ({
        ...payload,
        id: payload.id || newId(),
        created_at: new Date().toISOString(),
      }) as VisitImage
  );
}

export async function listVisitImages(visitId: string): Promise<VisitImage[]> {
  return listWithFallback<VisitImage>(
    'listVisitImages',
    'visit_images',
    () =>
      supabase
        .from('visit_images')
        .select('*')
        .eq('visit_id', visitId)
        .order('page_number', { ascending: true }),
    (items) => items.filter((img) => img.visit_id === visitId)
  );
}
