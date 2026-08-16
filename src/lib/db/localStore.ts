/**
 * Offline & Local Storage fallback store for client-side persistence
 * when remote Supabase instance lacks migrations or is offline.
 */

const STORAGE_PREFIX = 'medfolio_local_';

export function getLocalItems<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setLocalItems<T>(table: string, items: T[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(items));
  } catch {
    // Quota or storage unavailable
  }
}

export function insertLocalItem<T extends { id?: string }>(table: string, item: T): T {
  const items = getLocalItems<T>(table);
  // A random uuid, not a timestamp: rows created inside a loop share the same
  // millisecond, which produced colliding ids for bulk-saved prescriptions.
  const withId = { ...item, id: item.id || newId() };
  items.unshift(withId as T);
  setLocalItems(table, items);
  return withId as T;
}

/**
 * Generates an id valid for the `uuid` primary keys used across the schema, so
 * an offline row can later be pushed to Postgres unchanged.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes: RFC-4122 v4 shape from random bytes.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function updateLocalItem<T extends { id?: string }>(table: string, id: string, updates: Partial<T>): T | null {
  const items = getLocalItems<T>(table);
  let updated: T | null = null;
  const newItems = items.map((it) => {
    if (it.id === id) {
      updated = { ...it, ...updates };
      return updated;
    }
    return it;
  });
  setLocalItems(table, newItems);
  return updated;
}

export function deleteLocalItem<T extends { id?: string }>(table: string, id: string): void {
  const items = getLocalItems<T>(table);
  const newItems = items.filter((it) => it.id !== id);
  setLocalItems(table, newItems);
}
