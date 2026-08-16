import { describe, it, expect } from 'vitest';
import { parseDuration, computeEndDate } from '../duration';

describe('duration parsing (src/domain/duration.ts)', () => {
  it('parses day counts anchoring on unit (not first number)', () => {
    // Crucial rule: "1 tablet for 5 days" must be 5 days, NOT 1 day!
    expect(parseDuration('1 tablet for 5 days')).toEqual({ kind: 'days', days: 5 });
    expect(parseDuration('2 capsules for 10 days')).toEqual({ kind: 'days', days: 10 });
    expect(parseDuration('5 days')).toEqual({ kind: 'days', days: 5 });
    expect(parseDuration('5 din')).toEqual({ kind: 'days', days: 5 });
    expect(parseDuration('x5')).toEqual({ kind: 'days', days: 5 });
    expect(parseDuration('5/7')).toEqual({ kind: 'days', days: 5 });
  });

  it('parses weeks into days (7, 14, etc.)', () => {
    expect(parseDuration('1 week')).toEqual({ kind: 'days', days: 7 });
    expect(parseDuration('1 hafta')).toEqual({ kind: 'days', days: 7 });
    expect(parseDuration('2 weeks')).toEqual({ kind: 'days', days: 14 });
    expect(parseDuration('2 hafte')).toEqual({ kind: 'days', days: 14 });
  });

  it('parses months into days (30 days per month)', () => {
    expect(parseDuration('1 month')).toEqual({ kind: 'days', days: 30 });
    expect(parseDuration('3 months')).toEqual({ kind: 'days', days: 90 });
  });

  it('parses ongoing chronic phrasing', () => {
    expect(parseDuration('continue')).toEqual({ kind: 'ongoing' });
    expect(parseDuration('ongoing')).toEqual({ kind: 'ongoing' });
    expect(parseDuration('regular')).toEqual({ kind: 'ongoing' });
    expect(parseDuration('long term')).toEqual({ kind: 'ongoing' });
    expect(parseDuration('lifelong')).toEqual({ kind: 'ongoing' });
  });

  it('parses "till review" / uncertain phrasing as unknown (NEVER defaults)', () => {
    expect(parseDuration('till review')).toEqual({ kind: 'unknown' });
    expect(parseDuration('until follow-up')).toEqual({ kind: 'unknown' });
    expect(parseDuration('review ke baad')).toEqual({ kind: 'unknown' });
    expect(parseDuration('unreadable text')).toEqual({ kind: 'unknown' });
    expect(parseDuration('')).toEqual({ kind: 'unknown' });
    expect(parseDuration(null)).toEqual({ kind: 'unknown' });
  });

  it('calculates end date correctly with end_date = start_date + duration_days - 1', () => {
    // 5-day course starting Monday 2026-08-17 ends Friday 2026-08-21 (Mon, Tue, Wed, Thu, Fri = 5 days)
    expect(computeEndDate('2026-08-17', 5)).toBe('2026-08-21');

    // 1-day course starting 2026-08-17 ends 2026-08-17
    expect(computeEndDate('2026-08-17', 1)).toBe('2026-08-17');

    // 7-day course (1 week) starting 2026-08-17 ends Sunday 2026-08-23
    expect(computeEndDate('2026-08-17', 7)).toBe('2026-08-23');
  });
});
