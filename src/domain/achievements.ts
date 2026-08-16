export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
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
  activeDrugInteractionsCount: number;
}

export function evaluateAchievements(input: AchievementEvaluationInput): Achievement[] {
  const achievements: Achievement[] = [
    {
      id: 'streak_7',
      title: '7-Day Adherence Master',
      description: 'Maintained 100% on-time medication adherence for 7 consecutive days.',
      icon: '🔥',
      category: 'adherence',
      unlocked: input.adherenceStreakDays >= 7,
      progress: Math.min(100, Math.round((input.adherenceStreakDays / 7) * 100)),
      progressLabel: `${Math.min(7, input.adherenceStreakDays)} / 7 days`,
      badgeLevel: 'bronze',
    },
    {
      id: 'streak_30',
      title: 'Monthly Adherence Champion',
      description: 'Maintained uninterrupted medication compliance for a full 30-day cycle.',
      icon: '🏆',
      category: 'adherence',
      unlocked: input.adherenceStreakDays >= 30,
      progress: Math.min(100, Math.round((input.adherenceStreakDays / 30) * 100)),
      progressLabel: `${Math.min(30, input.adherenceStreakDays)} / 30 days`,
      badgeLevel: 'gold',
    },
    {
      id: 'glycemic_guardian',
      title: 'Glycemic Guardian',
      description: 'Logged 10 blood glucose readings within clinical target ranges.',
      icon: '🎯',
      category: 'vitals',
      unlocked: input.inRangeGlucoseCount >= 10,
      progress: Math.min(100, Math.round((input.inRangeGlucoseCount / 10) * 100)),
      progressLabel: `${Math.min(10, input.inRangeGlucoseCount)} / 10 target readings`,
      badgeLevel: 'silver',
    },
    {
      id: 'cardio_anchor',
      title: 'Cardiovascular Anchor',
      description: 'Recorded 10 blood pressure readings in the optimal/normal zone.',
      icon: '🩺',
      category: 'vitals',
      unlocked: input.normalBpCount >= 10,
      progress: Math.min(100, Math.round((input.normalBpCount / 10) * 100)),
      progressLabel: `${Math.min(10, input.normalBpCount)} / 10 normal BP logs`,
      badgeLevel: 'silver',
    },
    {
      id: 'safety_shield',
      title: 'Zero Interaction Shield',
      description: 'Active medications verified free of high-risk drug-drug interactions.',
      icon: '🛡️',
      category: 'safety',
      unlocked: input.totalPrescriptions > 0 && input.activeDrugInteractionsCount === 0,
      progress: input.totalPrescriptions > 0 && input.activeDrugInteractionsCount === 0 ? 100 : 0,
      progressLabel: input.activeDrugInteractionsCount === 0 && input.totalPrescriptions > 0 ? 'Verified Safe' : 'Review Required',
      badgeLevel: 'platinum',
    },
    {
      id: 'health_archivist',
      title: 'Master Health Archivist',
      description: 'Archived at least 5 clinical documents (prescriptions, visits, or lab reports).',
      icon: '📚',
      category: 'records',
      unlocked: input.totalPrescriptions + input.totalReports + input.totalVisits >= 5,
      progress: Math.min(100, Math.round(((input.totalPrescriptions + input.totalReports + input.totalVisits) / 5) * 100)),
      progressLabel: `${Math.min(5, input.totalPrescriptions + input.totalReports + input.totalVisits)} / 5 records`,
      badgeLevel: 'bronze',
    },
  ];

  return achievements;
}
