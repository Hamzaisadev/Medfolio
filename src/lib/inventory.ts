/**
 * Pill inventory counts, stored locally per profile.
 *
 * Keyed by profile so one family member's supply cannot be decremented by
 * another's doses (the previous single global key mixed them together).
 */

const PREFIX = 'medfolio_pill_inventory_v2_';

export type PillInventory = Record<string, number>;

export function inventoryKey(profileId: string): string {
  return `${PREFIX}${profileId}`;
}

export function readInventory(profileId: string): PillInventory {
  try {
    const raw = localStorage.getItem(inventoryKey(profileId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as PillInventory) : {};
  } catch {
    return {};
  }
}

export function writeInventory(profileId: string, inventory: PillInventory): void {
  try {
    localStorage.setItem(inventoryKey(profileId), JSON.stringify(inventory));
  } catch {
    // Quota or storage unavailable — inventory is a convenience, not a record.
  }
}

/**
 * Decrements the count for one medicine by one pill.
 *
 * Returns the new count, or null if there was nothing to decrement. Callers use
 * the null to avoid claiming "-1 pill" when no inventory is tracked.
 */
export function decrementPill(profileId: string, medicineId: string): number | null {
  const inventory = readInventory(profileId);
  const current = inventory[medicineId];

  if (typeof current !== 'number' || current <= 0) {
    return null;
  }

  inventory[medicineId] = current - 1;
  writeInventory(profileId, inventory);
  return inventory[medicineId];
}

/** Restores one pill, used when a dose is un-marked. */
export function incrementPill(profileId: string, medicineId: string): void {
  const inventory = readInventory(profileId);
  if (typeof inventory[medicineId] !== 'number') return;
  inventory[medicineId] += 1;
  writeInventory(profileId, inventory);
}
