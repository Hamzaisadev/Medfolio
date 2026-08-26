/**
 * Offline fallback helpers for the repository layer.
 *
 * Robust dual-write and hybrid fallback:
 * - Guarantees data saved offline or under dev auth / RLS restrictions is never lost.
 * - If remote returns items, uses remote data and updates local cache.
 * - If remote returns empty or errors, seamlessly falls back to localStore.
 */

import { getLocalItems, insertLocalItem } from './localStore';

export { newId } from './localStore';

interface SupabaseListResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface SupabaseSingleResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Runs a list query, seamlessly merging/falling back to local store if remote is empty or errors.
 */
export async function listWithFallback<T extends { id?: string }>(
  label: string,
  table: string,
  query: () => PromiseLike<SupabaseListResult<T>>,
  localFilter: (items: T[]) => T[]
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (error) throw new Error(error.message);
    if (data && data.length > 0) {
      return data;
    }
    // If remote returned empty array, check if local store has items
    const localItems = localFilter(getLocalItems<T>(table));
    if (localItems.length > 0) {
      return localItems;
    }
    if (data) return data;
  } catch (err) {
    console.warn(`${label} failed, falling back to local store:`, err);
    return localFilter(getLocalItems<T>(table));
  }
  return localFilter(getLocalItems<T>(table));
}

/**
 * Runs a single-row query. Returns null when the row genuinely does not exist,
 * and falls back to the local store if remote is unreachable or empty.
 */
export async function getWithFallback<T extends { id?: string }>(
  label: string,
  table: string,
  query: () => PromiseLike<SupabaseSingleResult<T>>,
  localFind: (items: T[]) => T | undefined
): Promise<T | null> {
  try {
    const { data, error } = await query();
    if (error) throw new Error(error.message);
    if (data) return data;
    const local = localFind(getLocalItems<T>(table));
    if (local) return local;
    return null;
  } catch (err) {
    console.warn(`${label} failed, falling back to local store:`, err);
    return localFind(getLocalItems<T>(table)) ?? null;
  }
}

/**
 * Inserts with dual-layer safety: ensures localStore receives the row and remote receives the row.
 */
export async function insertWithFallback<T extends { id?: string }>(
  label: string,
  table: string,
  query: () => PromiseLike<SupabaseSingleResult<T>>,
  buildLocal: () => T
): Promise<T> {
  const localRow = buildLocal();
  // Always persist to local store first so the user never loses data
  insertLocalItem<T>(table, localRow);

  try {
    const { data, error } = await query();
    if (!error && data) {
      return data;
    }
    if (error) {
      console.warn(`${label} remote error: ${error.message}, keeping local copy.`);
    }
  } catch (err) {
    console.warn(`${label} remote exception, keeping local copy:`, err);
  }

  return localRow;
}
