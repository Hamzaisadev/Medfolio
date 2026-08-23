import { supabase } from '../supabase/client';
import { getLocalItems, deleteLocalItem, newId } from './localStore';
import { insertWithFallback, listWithFallback } from './offlineFallback';
import type { GlucoseReading, BloodPressureReading } from '../../domain/vitals';

/**
 * The generated `Database` type does not yet cover the vitals tables added in
 * migration 0014, so these calls are untyped at the client boundary. Re-run
 * `npm run db:types` to replace these casts with generated types.
 *
 * The `any` is deliberate and scoped to this one shim: PostGREST's builder is
 * chainable and awaitable, and hand-writing a stand-in for it would be a second
 * source of truth that then has to be kept correct until the real types land.
 */
const db = supabase as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function sortByMeasuredAtDesc<T extends { measured_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
  );
}

export async function listGlucoseReadings(profileId: string): Promise<GlucoseReading[]> {
  return listWithFallback<GlucoseReading>(
    'listGlucoseReadings',
    'glucose_readings',
    () =>
      db
        .from('glucose_readings')
        .select('*')
        .eq('profile_id', profileId)
        .order('measured_at', { ascending: false }),
    (items) => sortByMeasuredAtDesc(items.filter((g) => g.profile_id === profileId))
  );
}

export async function createGlucoseReading(reading: GlucoseReading): Promise<GlucoseReading> {
  const payload = { ...reading, id: reading.id || newId() };

  return insertWithFallback<GlucoseReading>(
    'createGlucoseReading',
    'glucose_readings',
    () => db.from('glucose_readings').insert(payload).select().single(),
    () => payload
  );
}

export async function deleteGlucoseReading(id: string): Promise<void> {
  const { error } = await db.from('glucose_readings').delete().eq('id', id);
  if (error) {
    throw new Error(`Could not delete this glucose reading: ${error.message}`);
  }
  deleteLocalItem('glucose_readings', id);
}

export async function listBloodPressureReadings(
  profileId: string
): Promise<BloodPressureReading[]> {
  return listWithFallback<BloodPressureReading>(
    'listBloodPressureReadings',
    'blood_pressure_readings',
    () =>
      db
        .from('blood_pressure_readings')
        .select('*')
        .eq('profile_id', profileId)
        .order('measured_at', { ascending: false }),
    (items) => sortByMeasuredAtDesc(items.filter((b) => b.profile_id === profileId))
  );
}

export async function createBloodPressureReading(
  reading: BloodPressureReading
): Promise<BloodPressureReading> {
  const payload = { ...reading, id: reading.id || newId() };

  return insertWithFallback<BloodPressureReading>(
    'createBloodPressureReading',
    'blood_pressure_readings',
    () => db.from('blood_pressure_readings').insert(payload).select().single(),
    () => payload
  );
}

export async function deleteBloodPressureReading(id: string): Promise<void> {
  const { error } = await db.from('blood_pressure_readings').delete().eq('id', id);
  if (error) {
    throw new Error(`Could not delete this blood pressure reading: ${error.message}`);
  }
  deleteLocalItem('blood_pressure_readings', id);
}

/** Exposed for tests and diagnostics. */
export function localGlucoseReadings(): GlucoseReading[] {
  return getLocalItems<GlucoseReading>('glucose_readings');
}
