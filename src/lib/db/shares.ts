import { supabase } from '../supabase/client';
import type { Tables, InsertTables } from '../supabase/types';
import { getLocalItems, insertLocalItem, updateLocalItem } from './localStore';

export type Share = Tables<'shares'>;
export type ShareInsert = InsertTables<'shares'>;

export interface SharedBrief {
  profile: Tables<'profiles'> | null;
  medicines: Tables<'medicines'>[];
  visits: Tables<'visits'>[];
  shared_at: string | null;
  expires_at: string | null;
}

export async function listShares(profileId: string): Promise<Share[]> {
  try {
    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });

    // An empty list is a valid answer, not a failure: only fall back to the
    // local store when the query itself could not be completed.
    if (!error && data) return data;
  } catch (err) {
    console.warn('Supabase listShares error, falling back to local store:', err);
  }

  const local = getLocalItems<Share>('shares');
  return local.filter((s) => s.profile_id === profileId);
}

export async function createShareRecord(share: ShareInsert): Promise<Share> {
  try {
    const { data, error } = await supabase.from('shares').insert(share).select().single();
    if (!error && data) return data;
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase createShareRecord error, saved locally:', err);
  }

  // Offline fallback. The id is generated with crypto so it cannot collide with
  // a concurrently created share the way a timestamp-based id would.
  return insertLocalItem<Share>('shares', {
    ...share,
    id: share.id || crypto.randomUUID(),
    view_count: share.view_count ?? 0,
    created_at: new Date().toISOString(),
  } as Share);
}

export async function revokeShare(id: string): Promise<void> {
  const revokedAt = new Date().toISOString();
  updateLocalItem<Share>('shares', id, { revoked_at: revokedAt });

  const { error } = await supabase.from('shares').update({ revoked_at: revokedAt }).eq('id', id);

  // Revocation must be reported when it fails: silently "revoking" only the
  // local copy would leave a live link the patient believes is dead.
  if (error) {
    throw new Error(`Could not revoke the share link: ${error.message}`);
  }
}

/**
 * Resolves a raw share token to the patient brief it grants access to.
 *
 * Goes through the `get_shared_brief` security-definer function rather than
 * querying tables directly: the anon role has no read access to patient tables,
 * and the raw token is hashed server-side so the database never stores it.
 * Returns null for unknown, revoked and expired tokens alike.
 */
export async function fetchSharedBrief(rawToken: string): Promise<SharedBrief | null> {
  const { data, error } = await supabase.rpc('get_shared_brief', { p_token: rawToken });

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  const brief = data as unknown as Partial<SharedBrief>;
  return {
    profile: brief.profile ?? null,
    medicines: Array.isArray(brief.medicines) ? brief.medicines : [],
    visits: Array.isArray(brief.visits) ? brief.visits : [],
    shared_at: brief.shared_at ?? null,
    expires_at: brief.expires_at ?? null,
  };
}
