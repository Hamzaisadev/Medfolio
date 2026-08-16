import { describe, it, expect } from 'vitest';
import { buildSchedule } from '../schedule';
import { todayInAppTz } from '../../lib/time';

describe('schedule generation (src/domain/schedule.ts)', () => {
  it('generates zero doses for PRN / empty dose times', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const schedule = buildSchedule({
      medicineId: 'med-prn',
      startDate: '2026-08-15',
      durationDays: 5,
      isOngoing: false,
      doseTimes: [], // PRN has empty doseTimes
      now,
    });
    expect(schedule).toEqual([]);
  });

  it('generates zero doses when duration is null and not ongoing', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const schedule = buildSchedule({
      medicineId: 'med-null-dur',
      startDate: '2026-08-15',
      durationDays: null,
      isOngoing: false,
      doseTimes: [540, 1260],
      now,
    });
    expect(schedule).toEqual([]);
  });

  it('generates exact number of doses for a fixed duration (BD for 5 days = 10 doses)', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const schedule = buildSchedule({
      medicineId: 'med-bd-5d',
      startDate: '2026-08-15',
      durationDays: 5,
      isOngoing: false,
      doseTimes: [540, 1260], // 09:00, 21:00
      now,
    });

    expect(schedule).toHaveLength(10);
    // First day doses
    expect(schedule[0]).toEqual({ scheduled_date: '2026-08-15', scheduled_minutes: 540 });
    expect(schedule[1]).toEqual({ scheduled_date: '2026-08-15', scheduled_minutes: 1260 });
    // Last day doses (5th day: 2026-08-19)
    expect(schedule[8]).toEqual({ scheduled_date: '2026-08-19', scheduled_minutes: 540 });
    expect(schedule[9]).toEqual({ scheduled_date: '2026-08-19', scheduled_minutes: 1260 });
  });

  it('generates 30 days of doses for ongoing medication', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const schedule = buildSchedule({
      medicineId: 'med-ongoing-od',
      startDate: '2026-08-15',
      durationDays: null,
      isOngoing: true,
      doseTimes: [540], // OD (1/day)
      now,
    });

    expect(schedule).toHaveLength(30);
    expect(schedule[0]?.scheduled_date).toBe('2026-08-15');
    expect(schedule[29]?.scheduled_date).toBe('2026-09-13');
  });

  it('is idempotent (repeated runs produce identical outputs)', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const input = {
      medicineId: 'med-idemp',
      startDate: '2026-08-15',
      durationDays: 3,
      isOngoing: false,
      doseTimes: [480, 840, 1200], // TDS
      now,
    };

    const run1 = buildSchedule(input);
    const run2 = buildSchedule(input);
    expect(run1).toEqual(run2);
  });

  it('CRITICAL: A test run at 02:00 PKT asserts the first dose date is today, not yesterday', () => {
    // 02:00 PKT on 2026-08-16 corresponds to 2026-08-15T21:00:00Z in UTC
    const clockAt2amPkt = new Date('2026-08-15T21:00:00Z');
    const todayInPkt = todayInAppTz(clockAt2amPkt);
    expect(todayInPkt).toBe('2026-08-16');

    const schedule = buildSchedule({
      medicineId: 'med-pkt-test',
      startDate: todayInPkt,
      durationDays: 3,
      isOngoing: false,
      doseTimes: [540, 1260],
      now: clockAt2amPkt,
    });

    expect(schedule[0]?.scheduled_date).toBe('2026-08-16'); // Today (16th), NEVER 15th
  });

  describe('dosing interval', () => {
    const now = new Date('2026-08-15T10:00:00Z');

    it('CRITICAL: WEEKLY doses every 7th day, never daily', () => {
      // A weekly drug expanded daily (e.g. methotrexate) is a severe dosing error.
      const schedule = buildSchedule({
        medicineId: 'med-weekly',
        startDate: '2026-08-15',
        durationDays: 28,
        isOngoing: false,
        doseTimes: [540],
        now,
        frequencyCode: 'WEEKLY',
      });

      expect(schedule).toHaveLength(4);
      expect(schedule.map((d) => d.scheduled_date)).toEqual([
        '2026-08-15',
        '2026-08-22',
        '2026-08-29',
        '2026-09-05',
      ]);
    });

    it('CRITICAL: STAT produces exactly one dose regardless of duration', () => {
      const schedule = buildSchedule({
        medicineId: 'med-stat',
        startDate: '2026-08-15',
        durationDays: 5,
        isOngoing: false,
        doseTimes: [540],
        now,
        frequencyCode: 'STAT',
      });

      expect(schedule).toEqual([{ scheduled_date: '2026-08-15', scheduled_minutes: 540 }]);
    });

    it('STAT ignores isOngoing and extra dose times', () => {
      const schedule = buildSchedule({
        medicineId: 'med-stat-ongoing',
        startDate: '2026-08-15',
        durationDays: null,
        isOngoing: true,
        doseTimes: [540, 1260],
        now,
        frequencyCode: 'STAT',
      });

      expect(schedule).toHaveLength(1);
    });

    it('WEEKLY over an ongoing course covers the 30-day horizon weekly', () => {
      const schedule = buildSchedule({
        medicineId: 'med-weekly-ongoing',
        startDate: '2026-08-15',
        durationDays: null,
        isOngoing: true,
        doseTimes: [540],
        now,
        frequencyCode: 'WEEKLY',
      });

      // Offsets 0, 7, 14, 21, 28 within the 30-day horizon.
      expect(schedule).toHaveLength(5);
      expect(schedule[4]?.scheduled_date).toBe('2026-09-12');
    });

    it('multi-dose daily codes still dose every day', () => {
      for (const code of ['OD', 'BD', 'TDS', 'QID', 'QHS'] as const) {
        const schedule = buildSchedule({
          medicineId: `med-${code}`,
          startDate: '2026-08-15',
          durationDays: 3,
          isOngoing: false,
          doseTimes: [540, 1260],
          now,
          frequencyCode: code,
        });
        expect(schedule, code).toHaveLength(6);
      }
    });

    it('treats an unknown frequency code as daily', () => {
      const schedule = buildSchedule({
        medicineId: 'med-no-code',
        startDate: '2026-08-15',
        durationDays: 3,
        isOngoing: false,
        doseTimes: [540],
        now,
        frequencyCode: null,
      });
      expect(schedule).toHaveLength(3);
    });

    it('caps a very long fixed course at 365 days', () => {
      const schedule = buildSchedule({
        medicineId: 'med-long',
        startDate: '2026-08-15',
        durationDays: 5000,
        isOngoing: false,
        doseTimes: [540],
        now,
      });
      expect(schedule).toHaveLength(365);
    });
  });
});
