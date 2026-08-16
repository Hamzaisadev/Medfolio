import { describe, it, expect } from 'vitest';
import {
  todayInAppTz,
  toAppDate,
  fromAppDate,
  addDaysAppTz,
  formatDoseTime,
  formatMinutesTo24h,
  parseTimeToMinutes,
  APP_TIMEZONE,
} from '../../lib/time';

describe('time utilities (src/lib/time.ts)', () => {
  it('has Asia/Karachi as APP_TIMEZONE', () => {
    expect(APP_TIMEZONE).toBe('Asia/Karachi');
  });

  it('correctly handles Pakistan UTC+5 midnight transition (02:30 PKT is next calendar day)', () => {
    const lateUtcDate = new Date('2026-08-15T21:30:00Z');
    expect(todayInAppTz(lateUtcDate)).toBe('2026-08-16');
    expect(toAppDate(lateUtcDate)).toBe('2026-08-16');
  });

  it('correctly returns today in PKT for early morning UTC', () => {
    const date = new Date('2026-08-15T01:00:00Z');
    expect(todayInAppTz(date)).toBe('2026-08-15');
  });

  it('fromAppDate and addDaysAppTz handle calendar day transitions correctly', () => {
    expect(addDaysAppTz('2026-08-15', 5)).toBe('2026-08-20');
    expect(addDaysAppTz('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysAppTz('2026-01-01', -1)).toBe('2025-12-31');

    const parsed = fromAppDate('2026-08-16');
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(7);
    expect(parsed.getUTCDate()).toBe(16);

    expect(() => fromAppDate('invalid')).toThrow();
  });

  it('formatDoseTime formats minutes since midnight into 12h representation', () => {
    expect(formatDoseTime(0)).toBe('12:00 AM');
    expect(formatDoseTime(300)).toBe('05:00 AM');
    expect(formatDoseTime(540)).toBe('09:00 AM');
    expect(formatDoseTime(720)).toBe('12:00 PM');
    expect(formatDoseTime(1260)).toBe('09:00 PM');
    expect(formatDoseTime(1350)).toBe('10:30 PM');
  });

  it('formatMinutesTo24h formats minutes into 24-hour HH:mm string', () => {
    expect(formatMinutesTo24h(540)).toBe('09:00');
    expect(formatMinutesTo24h(1260)).toBe('21:00');
    expect(formatMinutesTo24h(0)).toBe('00:00');
  });

  it('parseTimeToMinutes parses 12-hour and 24-hour formats accurately', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540);
    expect(parseTimeToMinutes('21:00')).toBe(1260);
    expect(parseTimeToMinutes('09:30 AM')).toBe(570);
    expect(parseTimeToMinutes('9:30 am')).toBe(570);
    expect(parseTimeToMinutes('9:00 pm')).toBe(1260);
    expect(parseTimeToMinutes('12:00 AM')).toBe(0);
    expect(parseTimeToMinutes('12:00 PM')).toBe(720);
    expect(parseTimeToMinutes('invalid')).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();
    expect(parseTimeToMinutes(null)).toBeNull();
  });
});
