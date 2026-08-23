import { describe, it, expect } from 'vitest';
import {
  calculateAdherence,
  calculateAdherenceStreak,
  deriveStatusOnRead,
  DoseRecord,
} from '../adherence';

describe('adherence calculation (src/domain/adherence.ts)', () => {
  // Current time: 14:00 (840 min) PKT on 2026-08-15 -> 09:00 UTC
  const now = new Date('2026-08-15T09:00:00Z');

  it('excludes future pending doses from the denominator', () => {
    const doses: DoseRecord[] = [
      // Past yesterday taken dose
      { id: '1', medicine_id: 'm1', scheduled_date: '2026-08-14', scheduled_minutes: 540, status: 'taken' },
      // Future tomorrow pending dose
      { id: '2', medicine_id: 'm1', scheduled_date: '2026-08-16', scheduled_minutes: 540, status: 'pending' },
    ];

    const stats = calculateAdherence(doses, { from: '2026-08-14', to: '2026-08-16' }, now);
    expect(stats.scheduled).toBe(1); // ONLY the past dose, future is excluded
    expect(stats.taken).toBe(1);
    expect(stats.percentage).toBe(100);
  });

  it('excludes PRN medicines from adherence calculation entirely', () => {
    const doses: DoseRecord[] = [
      { id: '1', medicine_id: 'm-prn', scheduled_date: '2026-08-14', scheduled_minutes: 540, status: 'pending', is_prn: true },
      { id: '2', medicine_id: 'm-reg', scheduled_date: '2026-08-14', scheduled_minutes: 540, status: 'taken' },
    ];

    const stats = calculateAdherence(doses, { from: '2026-08-14', to: '2026-08-15' }, now);
    expect(stats.scheduled).toBe(1);
    expect(stats.taken).toBe(1);
  });

  it('marks pending dose > 4 hours overdue as missed on read', () => {
    // Current time: 14:00 PKT (840 min)
    // Morning 08:00 dose (480 min) is 6 hours ago (> 4 hours) -> missed
    // Afternoon 13:00 dose (780 min) is 1 hour ago (<= 4 hours) -> still pending (not missed yet)
    const doses: DoseRecord[] = [
      { id: '1', medicine_id: 'm1', scheduled_date: '2026-08-15', scheduled_minutes: 480, status: 'pending' },
      { id: '2', medicine_id: 'm1', scheduled_date: '2026-08-15', scheduled_minutes: 780, status: 'pending' },
    ];

    const stats = calculateAdherence(doses, { from: '2026-08-15', to: '2026-08-15' }, now);
    expect(stats.scheduled).toBe(1); // Only the >4h overdue dose counts in denominator
    expect(stats.missed).toBe(1);
    expect(stats.taken).toBe(0);
    expect(stats.percentage).toBe(0);
  });

  it('counts deliberate skip against adherence percentage', () => {
    const doses: DoseRecord[] = [
      { id: '1', medicine_id: 'm1', scheduled_date: '2026-08-14', scheduled_minutes: 540, status: 'taken' },
      { id: '2', medicine_id: 'm1', scheduled_date: '2026-08-14', scheduled_minutes: 1260, status: 'skipped' },
    ];

    const stats = calculateAdherence(doses, { from: '2026-08-14', to: '2026-08-14' }, now);
    expect(stats.scheduled).toBe(2);
    expect(stats.taken).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.percentage).toBe(50);
  });

  it('counts a stored missed dose dated today', () => {
    // Previously this fell through every branch and vanished from both the
    // numerator and the denominator.
    const doses: DoseRecord[] = [
      { id: '1', medicine_id: 'm1', scheduled_date: '2026-08-15', scheduled_minutes: 780, status: 'missed' },
      { id: '2', medicine_id: 'm1', scheduled_date: '2026-08-15', scheduled_minutes: 480, status: 'taken' },
    ];

    const stats = calculateAdherence(doses, { from: '2026-08-15', to: '2026-08-15' }, now);
    expect(stats.scheduled).toBe(2);
    expect(stats.missed).toBe(1);
    expect(stats.taken).toBe(1);
    expect(stats.percentage).toBe(50);
  });

  it('reports zeros rather than 100% when nothing is scheduled', () => {
    const stats = calculateAdherence([], { from: '2026-08-15', to: '2026-08-15' }, now);
    expect(stats.scheduled).toBe(0);
    expect(stats.percentage).toBe(0);
  });
});

describe('deriveStatusOnRead', () => {
  const now = new Date('2026-08-15T09:00:00Z'); // 14:00 PKT

  it('preserves a stored missed status instead of downgrading it to pending', () => {
    expect(
      deriveStatusOnRead(
        { status: 'missed', scheduled_date: '2026-08-15', scheduled_minutes: 780 },
        now
      )
    ).toBe('missed');
  });

  it('preserves taken and skipped', () => {
    expect(
      deriveStatusOnRead({ status: 'taken', scheduled_date: '2026-08-15', scheduled_minutes: 780 }, now)
    ).toBe('taken');
    expect(
      deriveStatusOnRead({ status: 'skipped', scheduled_date: '2026-08-15', scheduled_minutes: 780 }, now)
    ).toBe('skipped');
  });

  it('derives missed for a past pending dose and for one over the grace window', () => {
    expect(
      deriveStatusOnRead({ status: 'pending', scheduled_date: '2026-08-14', scheduled_minutes: 540 }, now)
    ).toBe('missed');
    expect(
      deriveStatusOnRead({ status: 'pending', scheduled_date: '2026-08-15', scheduled_minutes: 480 }, now)
    ).toBe('missed');
  });

  it('keeps a dose pending inside the grace window and in the future', () => {
    expect(
      deriveStatusOnRead({ status: 'pending', scheduled_date: '2026-08-15', scheduled_minutes: 780 }, now)
    ).toBe('pending');
    expect(
      deriveStatusOnRead({ status: 'pending', scheduled_date: '2026-08-16', scheduled_minutes: 540 }, now)
    ).toBe('pending');
  });

  it('CRITICAL: resolves the PKT date and time consistently after midnight UTC+5', () => {
    // 01:00 PKT on 2026-08-16 == 2026-08-15T20:00:00Z. A dose scheduled 09:00 on
    // the 16th must still be pending, not missed against the previous day.
    const earlyPkt = new Date('2026-08-15T20:00:00Z');
    expect(
      deriveStatusOnRead({ status: 'pending', scheduled_date: '2026-08-16', scheduled_minutes: 540 }, earlyPkt)
    ).toBe('pending');
    expect(
      deriveStatusOnRead({ status: 'pending', scheduled_date: '2026-08-15', scheduled_minutes: 540 }, earlyPkt)
    ).toBe('missed');
  });
});

describe('calculateAdherenceStreak', () => {
  const now = new Date('2026-08-15T09:00:00Z'); // 14:00 PKT on the 15th

  const perfectDay = (date: string, id: string): DoseRecord[] => [
    { id: `${id}a`, medicine_id: 'm1', scheduled_date: date, scheduled_minutes: 480, status: 'taken' },
    { id: `${id}b`, medicine_id: 'm1', scheduled_date: date, scheduled_minutes: 1200, status: 'taken' },
  ];

  it('CRITICAL: returns 0 for a user with no doses at all', () => {
    // The dashboard previously derived a 7-day streak from an empty schedule and
    // unlocked "7-Day Adherence Master" on day one.
    expect(calculateAdherenceStreak([], now)).toBe(0);
  });

  it('counts consecutive fully-taken days', () => {
    const doses = [
      ...perfectDay('2026-08-14', '1'),
      ...perfectDay('2026-08-13', '2'),
      ...perfectDay('2026-08-12', '3'),
    ];
    expect(calculateAdherenceStreak(doses, now)).toBe(3);
  });

  it('breaks the streak on a missed dose', () => {
    const doses: DoseRecord[] = [
      ...perfectDay('2026-08-14', '1'),
      { id: 'x', medicine_id: 'm1', scheduled_date: '2026-08-13', scheduled_minutes: 480, status: 'missed' },
      ...perfectDay('2026-08-12', '3'),
    ];
    expect(calculateAdherenceStreak(doses, now)).toBe(1);
  });

  it('breaks the streak on a skipped dose', () => {
    const doses: DoseRecord[] = [
      ...perfectDay('2026-08-14', '1'),
      { id: 'x', medicine_id: 'm1', scheduled_date: '2026-08-13', scheduled_minutes: 480, status: 'skipped' },
    ];
    expect(calculateAdherenceStreak(doses, now)).toBe(1);
  });

  it('does not penalise a day still in progress', () => {
    // Today has a dose that is not yet due, so today is neither counted nor
    // treated as a failure.
    const doses: DoseRecord[] = [
      { id: 'today', medicine_id: 'm1', scheduled_date: '2026-08-15', scheduled_minutes: 1200, status: 'pending' },
      ...perfectDay('2026-08-14', '1'),
      ...perfectDay('2026-08-13', '2'),
    ];
    expect(calculateAdherenceStreak(doses, now)).toBe(2);
  });

  it('counts today once every dose has settled', () => {
    const doses = [...perfectDay('2026-08-15', '0'), ...perfectDay('2026-08-14', '1')];
    expect(calculateAdherenceStreak(doses, now)).toBe(2);
  });

  it('ignores PRN doses when judging a day', () => {
    const doses: DoseRecord[] = [
      ...perfectDay('2026-08-14', '1'),
      { id: 'prn', medicine_id: 'm-prn', scheduled_date: '2026-08-14', scheduled_minutes: 600, status: 'pending', is_prn: true },
    ];
    expect(calculateAdherenceStreak(doses, now)).toBe(1);
  });

  it('skips days with nothing scheduled without breaking the streak', () => {
    const doses = [
      ...perfectDay('2026-08-14', '1'),
      // nothing on the 13th
      ...perfectDay('2026-08-12', '2'),
    ];
    expect(calculateAdherenceStreak(doses, now)).toBe(2);
  });
});
