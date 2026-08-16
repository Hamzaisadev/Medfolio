import { describe, it, expect } from 'vitest';
import { calculateAdherence, DoseRecord } from '../adherence';

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
});
