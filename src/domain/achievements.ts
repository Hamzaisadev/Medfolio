/**
 * Which icon represents the achievement.
 *
 * A key rather than an emoji or a component: the domain layer stays free of JSX,
 * and the UI can render a real stroked icon that inherits colour and renders
 * identically on every platform. Emoji do neither — they ignore `currentColor`
 * and each OS draws its own.
 */
export type AchievementIcon = 'streak' | 'trophy' | 'target' | 'heart' | 'trend' | 'archive';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  category: 'adherence' | 'vitals' | 'records' | 'safety';
  unlocked: boolean;
  progress: number; // 0 to 100
  progressLabel: string;
  badgeLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface AchievementEvaluationInput {
  adherenceStreakDays: number;
  totalPrescriptions: number;
  totalReports: number;
  totalVisits: number;
  glucoseLogsCount: number;
  inRangeGlucoseCount: number;
  bpLogsCount: number;
  normalBpCount: number;
}

/** Percentage of a target, clamped to 0–100. */
function progressToward(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

export function evaluateAchievements(input: AchievementEvaluationInput): Achievement[] {
  const totalRecords = input.totalPrescriptions + input.totalReports + input.totalVisits;

  const achievements: Achievement[] = [
    {
      id: 'streak_7',
      title: '7-Day Adherence Master',
      description: 'Maintained 100% on-time medication adherence for 7 consecutive days.',
      icon: 'streak',
      category: 'adherence',
      unlocked: input.adherenceStreakDays >= 7,
      progress: progressToward(input.adherenceStreakDays, 7),
      progressLabel: `${Math.min(7, input.adherenceStreakDays)} / 7 days`,
      badgeLevel: 'bronze',
    },
    {
      id: 'streak_30',
      title: 'Monthly Adherence Champion',
      description: 'Maintained uninterrupted medication compliance for a full 30-day cycle.',
      icon: 'trophy',
      category: 'adherence',
      unlocked: input.adherenceStreakDays >= 30,
      progress: progressToward(input.adherenceStreakDays, 30),
      progressLabel: `${Math.min(30, input.adherenceStreakDays)} / 30 days`,
      badgeLevel: 'gold',
    },
    {
      id: 'glycemic_guardian',
      title: 'Glycemic Guardian',
      description: 'Logged 10 blood glucose readings within clinical target ranges.',
      icon: 'target',
      category: 'vitals',
      unlocked: input.inRangeGlucoseCount >= 10,
      progress: progressToward(input.inRangeGlucoseCount, 10),
      progressLabel: `${Math.min(10, input.inRangeGlucoseCount)} / 10 target readings`,
      badgeLevel: 'silver',
    },
    {
      id: 'cardio_anchor',
      title: 'Cardiovascular Anchor',
      description: 'Recorded 10 blood pressure readings in the optimal/normal zone.',
      icon: 'heart',
      category: 'vitals',
      unlocked: input.normalBpCount >= 10,
      progress: progressToward(input.normalBpCount, 10),
      progressLabel: `${Math.min(10, input.normalBpCount)} / 10 normal BP logs`,
      badgeLevel: 'silver',
    },
    // The former "Zero Interaction Shield / Verified Safe" badge is deliberately
    // absent. Nothing in the app performs drug-drug interaction checking, so it
    // unlocked for every user with a prescription and told them their medicines
    // were "verified free of high-risk interactions" — a safety claim the app
    // cannot make. Reinstate it only alongside a real interaction check.
    {
      id: 'vitals_logger',
      title: 'Consistent Monitor',
      description: 'Logged 20 vital sign readings, giving your doctor a real trend to work with.',
      icon: 'trend',
      category: 'vitals',
      unlocked: input.glucoseLogsCount + input.bpLogsCount >= 20,
      progress: progressToward(input.glucoseLogsCount + input.bpLogsCount, 20),
      progressLabel: `${Math.min(20, input.glucoseLogsCount + input.bpLogsCount)} / 20 readings`,
      badgeLevel: 'bronze',
    },
    {
      id: 'health_archivist',
      title: 'Master Health Archivist',
      description: 'Archived at least 5 clinical documents (prescriptions, visits, or lab reports).',
      icon: 'archive',
      category: 'records',
      unlocked: totalRecords >= 5,
      progress: progressToward(totalRecords, 5),
      progressLabel: `${Math.min(5, totalRecords)} / 5 records`,
      badgeLevel: 'bronze',
    },
  ];

  return achievements;
}
