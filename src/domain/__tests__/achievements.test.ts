import { describe, it, expect } from 'vitest';
import { evaluateAchievements, type AchievementEvaluationInput } from '../achievements';

const baseInput: AchievementEvaluationInput = {
  adherenceStreakDays: 0,
  totalPrescriptions: 0,
  totalReports: 0,
  totalVisits: 0,
  glucoseLogsCount: 0,
  inRangeGlucoseCount: 0,
  bpLogsCount: 0,
  normalBpCount: 0,
};

const evaluate = (overrides: Partial<AchievementEvaluationInput> = {}) =>
  evaluateAchievements({ ...baseInput, ...overrides });

describe('Achievements & Milestone Engine', () => {
  it('unlocks 7-day adherence master when streak >= 7', () => {
    const list = evaluate({
      adherenceStreakDays: 8,
      totalPrescriptions: 2,
      totalReports: 1,
      totalVisits: 2,
      glucoseLogsCount: 5,
      inRangeGlucoseCount: 4,
      bpLogsCount: 3,
      normalBpCount: 2,
    });

    const streak7 = list.find((a) => a.id === 'streak_7');
    expect(streak7?.unlocked).toBe(true);
    expect(streak7?.progress).toBe(100);
  });

  it('keeps monthly champion locked when streak < 30', () => {
    const list = evaluate({ adherenceStreakDays: 15 });

    const streak30 = list.find((a) => a.id === 'streak_30');
    expect(streak30?.unlocked).toBe(false);
    expect(streak30?.progress).toBe(50);
  });

  it('evaluates Glycemic Guardian with target glucose logs', () => {
    const list = evaluate({ glucoseLogsCount: 12, inRangeGlucoseCount: 10 });
    expect(list.find((a) => a.id === 'glycemic_guardian')?.unlocked).toBe(true);
  });

  it('CRITICAL: does not award any safety badge, since nothing checks interactions', () => {
    // The former "Zero Interaction Shield / Verified Safe" badge unlocked for
    // every user with a prescription and asserted their medicines were free of
    // high-risk interactions — a claim the app never verified.
    const list = evaluate({ totalPrescriptions: 5 });

    expect(list.find((a) => a.id === 'safety_shield')).toBeUndefined();
    expect(list.some((a) => a.category === 'safety')).toBe(false);
    for (const achievement of list) {
      expect(achievement.progressLabel).not.toMatch(/verified safe/i);
    }
  });

  it('unlocks nothing for a brand-new user with no data', () => {
    const list = evaluate();
    expect(list.every((a) => !a.unlocked)).toBe(true);
    expect(list.every((a) => a.progress === 0)).toBe(true);
  });

  it('counts all record types toward the archivist badge', () => {
    expect(
      evaluate({ totalPrescriptions: 2, totalReports: 2, totalVisits: 1 }).find(
        (a) => a.id === 'health_archivist'
      )?.unlocked
    ).toBe(true);

    expect(
      evaluate({ totalPrescriptions: 1, totalReports: 1, totalVisits: 1 }).find(
        (a) => a.id === 'health_archivist'
      )?.progress
    ).toBe(60);
  });

  it('tracks total vitals logged for the consistency badge', () => {
    const list = evaluate({ glucoseLogsCount: 12, bpLogsCount: 8 });
    expect(list.find((a) => a.id === 'vitals_logger')?.unlocked).toBe(true);
  });

  it('clamps progress to 100 and never reports a negative value', () => {
    const list = evaluate({
      adherenceStreakDays: 400,
      inRangeGlucoseCount: 99,
      normalBpCount: 99,
      totalReports: 99,
    });
    for (const achievement of list) {
      expect(achievement.progress).toBeGreaterThanOrEqual(0);
      expect(achievement.progress).toBeLessThanOrEqual(100);
    }
  });
});
