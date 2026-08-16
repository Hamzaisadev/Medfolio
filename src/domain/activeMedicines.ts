/**
 * Active Medicine Filtering & Deduplication.
 *
 * Implements active medicine determination per 06-DOMAIN-RULES.md §Active medicines:
 * - A medicine is active if:
 *   1. discontinued_at is null
 *   2. start_date <= today
 *   3. is_ongoing === true OR end_date >= today
 * - Deduplicates by medicine_name ONLY among active courses, picking the most recent start_date.
 * - Extracts recently finished courses (finished within past 30 days).
 */

import { addDaysAppTz } from '../lib/time';

export interface MedicineRecord {
  id: string;
  medicine_name: string;
  strength?: string | null;
  form?: string | null;
  dose_amount?: string | null;
  frequency_raw?: string | null;
  frequency_code?: string | null;
  start_date: string; // 'YYYY-MM-DD'
  end_date?: string | null; // 'YYYY-MM-DD'
  duration_days?: number | null;
  is_ongoing: boolean;
  discontinued_at?: string | null;
  instructions?: string | null;
  with_food?: boolean | null;
}

/**
 * Checks if a single medicine record is currently active on a given date.
 */
export function isActive(medicine: MedicineRecord, today: string): boolean {
  // 1. Must not be discontinued
  if (medicine.discontinued_at) {
    return false;
  }

  // 2. Start date must be on or before today
  if (medicine.start_date > today) {
    return false; // future-scheduled course
  }

  // 3. Ongoing or end_date >= today
  if (medicine.is_ongoing) {
    return true;
  }

  if (medicine.end_date && medicine.end_date >= today) {
    return true;
  }

  return false;
}

/**
 * Returns all active medicines, deduplicated by medicine name (keeping most recent start_date).
 */
export function activeMedicines<T extends MedicineRecord>(medicines: T[], today: string): T[] {
  const activeList = medicines.filter((m) => isActive(m, today));

  // Sort by start_date descending so the newest course of a medicine comes first
  activeList.sort((a, b) => b.start_date.localeCompare(a.start_date));

  const seen = new Set<string>();
  const deduplicated: T[] = [];

  for (const med of activeList) {
    const key = med.medicine_name.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(med);
    }
  }

  return deduplicated;
}

/**
 * Returns medicines finished within the last `daysLookback` days (default 30 days).
 * Useful for the Doctor Brief to provide recent clinical context without falsely declaring them active.
 */
export function recentlyFinishedMedicines<T extends MedicineRecord>(
  medicines: T[],
  today: string,
  daysLookback: number = 30
): T[] {
  const thresholdDate = addDaysAppTz(today, -daysLookback);

  return medicines.filter((m) => {
    // If discontinued within the window
    if (m.discontinued_at) {
      const discDate = m.discontinued_at.slice(0, 10);
      return discDate >= thresholdDate && discDate <= today;
    }

    // If completed finite course within window
    if (!m.is_ongoing && m.end_date) {
      return m.end_date < today && m.end_date >= thresholdDate;
    }

    return false;
  });
}
