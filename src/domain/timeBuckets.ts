/**
 * Time Buckets for Schedule Segmentation.
 *
 * Partitions a 24-hour day (1,440 minutes) into 4 distinct, mutually exclusive buckets:
 * - morning:   05:00 – 11:59 (300 – 719)
 * - afternoon: 12:00 – 16:59 (720 – 1019)
 * - evening:   17:00 – 20:59 (1020 – 1259)
 * - night:     21:00 – 04:59 (1260 – 1439 and 0 – 299)
 */

export type Bucket = 'morning' | 'afternoon' | 'evening' | 'night';

export const BUCKET_DEFINITIONS: Record<
  Bucket,
  { label: string; timeRange: string; startHour: number; endHour: number }
> = {
  morning: { label: 'Morning', timeRange: '05:00 – 11:59', startHour: 5, endHour: 11 },
  afternoon: { label: 'Afternoon', timeRange: '12:00 – 16:59', startHour: 12, endHour: 16 },
  evening: { label: 'Evening', timeRange: '17:00 – 20:59', startHour: 17, endHour: 20 },
  night: { label: 'Night', timeRange: '21:00 – 04:59', startHour: 21, endHour: 4 },
};

export const BUCKET_ORDER: Bucket[] = ['morning', 'afternoon', 'evening', 'night'];

/**
 * Returns the corresponding time bucket for a given minute of the day (0–1439).
 * Bucketing is strictly performed by integer comparison on `scheduled_minutes`.
 */
export function bucketOf(minutes: number): Bucket {
  const norm = ((minutes % 1440) + 1440) % 1440;

  if (norm >= 300 && norm <= 719) {
    return 'morning';
  }
  if (norm >= 720 && norm <= 1019) {
    return 'afternoon';
  }
  if (norm >= 1020 && norm <= 1259) {
    return 'evening';
  }
  // 1260 to 1439 OR 0 to 299
  return 'night';
}
