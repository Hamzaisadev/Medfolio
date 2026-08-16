import { describe, it, expect } from 'vitest';
import { evaluateAchievements } from '../achievements';

describe('Achievements & Milestone Engine', () => {
  it('unlocks 7-day adherence master when streak >= 7', () => {
    const list = evaluateAchievements({
      adherenceStreakDays: 8,
      totalPrescriptions: 2,
      totalReports: 1,
      totalVisits: 2,
      glucoseLogsCount: 5,
      inRangeGlucoseCount: 4,
      bpLogsCount: 3,
      normalBpCount: 2,
      activeDrugInteractionsCount: 0,
    });

    const streak7 = list.find((a) => a.id === 'streak_7');
    expect(streak7?.unlocked).toBe(true);
    expect(streak7?.progress).toBe(100);
  });

  it('keeps monthly champion locked when streak < 30', () => {
    const list = evaluateAchievements({
      adherenceStreakDays: 15,
      totalPrescriptions: 2,
      totalReports: 1,
      totalVisits: 2,
      glucoseLogsCount: 5,
      inRangeGlucoseCount: 4,
      bpLogsCount: 3,
      normalBpCount: 2,
      activeDrugInteractionsCount: 0,
    });

    const streak30 = list.find((a) => a.id === 'streak_30');
    expect(streak30?.unlocked).toBe(false);
    expect(streak30?.progress).toBe(50);
  });

  it('evaluates Glycemic Guardian with target glucose logs', () => {
    const list = evaluateAchievements({
      adherenceStreakDays: 5,
      totalPrescriptions: 1,
      totalReports: 0,
      totalVisits: 0,
      glucoseLogsCount: 12,
      inRangeGlucoseCount: 10,
      bpLogsCount: 0,
      normalBpCount: 0,
      activeDrugInteractionsCount: 0,
    });

    const guardian = list.find((a) => a.id === 'glycemic_guardian');
    expect(guardian?.unlocked).toBe(true);
  });
});
