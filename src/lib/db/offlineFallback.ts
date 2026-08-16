/**
 * Offline fallback helpers for the repository layer.
 *
 * The rule these encode: an **empty result set is a valid answer**, not a
 * failure. Treating `[]` as "the query failed" made every deletion of a last
 * remaining row silently resurrect stale localStorage copies, and made the app
 * appear to work while running entirely offline.
 *
 * The local store is therefore consulted only when the query genuinely could
 * not be completed (network error, or a PostgREST error such as a missing table).
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
 * Runs a list query, falling back to `localFilter` over the local store only if
 * the query errors or throws.
 */
export async function listWithFallback<T>(
  label: string,
  table: string,
  query: () => PromiseLike<SupabaseListResult<T>>,
  localFilter: (items: T[]) => T[]
): Promise<T[]> {
  try {
    const { data, error } = await query();
    if (error) throw new Error(error.message);
    if (data) return data;
  } catch (err) {
    console.warn(`${label} failed, falling back to local store:`, err);
    return localFilter(getLocalItems<T>(table));
  }
  return localFilter(getLocalItems<T>(table));
}

/**
 * Runs a single-row query. Returns null when the row genuinely does not exist,
 * and falls back to the local store only when the query could not be completed.
 */
export async function getWithFallback<T>(
  label: string,
  table: string,
  query: () => PromiseLike<SupabaseSingleResult<T>>,
  localFind: (items: T[]) => T | undefined
): Promise<T | null> {
  try {
    const { data, error } = await query();
    if (error) throw new Error(error.message);
    return data ?? null;
  } catch (err) {
    console.warn(`${label} failed, falling back to local store:`, err);
    return localFind(getLocalItems<T>(table)) ?? null;
  }
}

/**
 * Inserts remotely first and only writes to the local store if that fails.
 *
 * Writing locally first (the previous behaviour) left an orphan row with a
 * client-generated id alongside the server row's uuid, which surfaced as
 * duplicate medicines and doses whenever a later read fell back to local.
 *
 * `buildLocal` supplies the offline row, including a `crypto.randomUUID()` id so
 * it satisfies the `uuid` column type and cannot collide the way a
 * `Date.now()`-derived id does inside a loop.
 */
export async function insertWithFallback<T extends { id?: string }>(
  label: string,
  table: string,
  query: () => PromiseLike<SupabaseSingleResult<T>>,
  buildLocal: () => T
): Promise<T> {
  try {
    const { data, error } = await query();
    if (error) throw new Error(error.message);
    if (data) return data;
    throw new Error('Insert returned no row');
  } catch (err) {
    console.warn(`${label} failed, saving to local store:`, err);
    return insertLocalItem<T>(table, buildLocal());
  }
}
