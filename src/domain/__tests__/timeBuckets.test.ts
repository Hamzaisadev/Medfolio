import { describe, it, expect } from 'vitest';
import { bucketOf, Bucket } from '../timeBuckets';

describe('timeBuckets (src/domain/timeBuckets.ts)', () => {
  it('maps specific sample times to their correct bucket', () => {
    // 05:00 (300 min) -> morning
    expect(bucketOf(300)).toBe('morning');
    // 09:00 (540 min) -> morning
    expect(bucketOf(540)).toBe('morning');
    // 11:59 (719 min) -> morning
    expect(bucketOf(719)).toBe('morning');

    // 12:00 (720 min) -> afternoon
    expect(bucketOf(720)).toBe('afternoon');
    // 14:00 (840 min) -> afternoon
    expect(bucketOf(840)).toBe('afternoon');
    // 16:59 (1019 min) -> afternoon
    expect(bucketOf(1019)).toBe('afternoon');

    // 17:00 (1020 min) -> evening
    expect(bucketOf(1020)).toBe('evening');
    // 19:30 (1170 min) -> evening
    expect(bucketOf(1170)).toBe('evening');
    // 20:59 (1259 min) -> evening
    expect(bucketOf(1259)).toBe('evening');

    // 21:00 (1260 min) -> night
    expect(bucketOf(1260)).toBe('night');
    // 23:59 (1439 min) -> night
    expect(bucketOf(1439)).toBe('night');
    // 00:00 (0 min) -> night (wraps midnight)
    expect(bucketOf(0)).toBe('night');
    // 04:59 (299 min) -> night
    expect(bucketOf(299)).toBe('night');
  });

  it('exhaustively partitions all 1,440 minutes into exactly one bucket', () => {
    const validBuckets = new Set<Bucket>(['morning', 'afternoon', 'evening', 'night']);
    let morningCount = 0;
    let afternoonCount = 0;
    let eveningCount = 0;
    let nightCount = 0;

    for (let minute = 0; minute < 1440; minute++) {
      const bucket = bucketOf(minute);
      expect(validBuckets.has(bucket)).toBe(true);

      if (bucket === 'morning') morningCount++;
      if (bucket === 'afternoon') afternoonCount++;
      if (bucket === 'evening') eveningCount++;
      if (bucket === 'night') nightCount++;
    }

    // morning: 300 to 719 = 420 minutes
    expect(morningCount).toBe(420);
    // afternoon: 720 to 1019 = 300 minutes
    expect(afternoonCount).toBe(300);
    // evening: 1020 to 1259 = 240 minutes
    expect(eveningCount).toBe(240);
    // night: (1440 - 1260) + 300 = 180 + 300 = 480 minutes
    expect(nightCount).toBe(480);

    // Sum must equal total minutes in a day
    expect(morningCount + afternoonCount + eveningCount + nightCount).toBe(1440);
  });
});
