import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ErrorState } from '../../components/ui/ErrorState';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Toast } from '../../components/ui/Toast';
import { MilestoneBadgeCard } from '../../components/ui/MilestoneBadgeCard';
import { MilestoneCelebrationModal } from '../../components/ui/MilestoneCelebrationModal';
import { QuickVitalsModal } from '../../components/vitals/QuickVitalsModal';
import { mealRelationIcon } from '../../components/ui/slotMeta';
import { VITAL_TONE } from '../../components/ui/vitalTone';
import {
  PrescriptionIcon,
  LabFlaskIcon,
  MedicineIcon,
  MedalIcon,
  DropletIcon,
  HeartPulseIcon,
  QuestionIcon,
  FileTextIcon,
  EmergencyAmbulanceIcon,
  ArrowRightIcon,
  ClockIcon,
  SparklesIcon,
  CheckIcon,
  FlameIcon,
  ActivityIcon,
  PlusIcon,
  CabinetIcon,
  CalendarIcon,
  AlertTriangleIcon,
} from '../../components/ui/icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, dosesRepo, testOrdersRepo, reportsRepo, visitsRepo } from '../../lib/db';
import { listGlucoseReadings, listBloodPressureReadings } from '../../lib/db/vitals';
import { decrementPill, readInventory } from '../../lib/inventory';
import { activeMedicines } from '../../domain/activeMedicines';
import { evaluateAchievements, type Achievement } from '../../domain/achievements';
import { calculateAdherence, calculateAdherenceStreak, deriveStatusOnRead } from '../../domain/adherence';
import {
  evaluateGlucose,
  evaluateBloodPressure,
  calculateMap,
  type GlucoseReading,
  type BloodPressureReading,
} from '../../domain/vitals';
import { mealRelationOf, mealRelationInstruction } from '../../domain/mealRelation';
import { todayInAppTz, addDaysAppTz, formatDoseTime, minutesInAppTz, formatDayHeading } from '../../lib/time';
import { staggerContainer, staggerItem } from '../../lib/motion';
import type { Tables } from '../../lib/supabase/types';

/** PRN doses are excluded from adherence: they are taken as needed, not on schedule. */
function isPrnMedicine(medicine: Tables<'medicines'> | undefined): boolean {
  return medicine?.frequency_code === 'PRN' || medicine?.frequency_code === 'SOS';
}

function formatReadingTime(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const EMERGENCY_NUMBERS = [
  { tel: '1122', label: 'Rescue Ambulance' },
  { tel: '115', label: 'Edhi Foundation' },
  { tel: '1020', label: 'Chhipa Welfare' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeMedsList, setActiveMedsList] = useState<Tables<'medicines'>[]>([]);
  const [medsMap, setMedsMap] = useState<Record<string, Tables<'medicines'>>>({});
  const [todayDoses, setTodayDoses] = useState<Tables<'doses'>[]>([]);
  const [streakDoses, setStreakDoses] = useState<Tables<'doses'>[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Tables<'test_orders'>[]>([]);
  const [recordCounts, setRecordCounts] = useState({ reports: 0, visits: 0 });

  const [glucoseLogs, setGlucoseLogs] = useState<GlucoseReading[]>([]);
  const [bpLogs, setBpLogs] = useState<BloodPressureReading[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Achievement | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'risk' } | null>(null);

  // Quick Vitals Logger Modal
  const [quickVitalsModal, setQuickVitalsModal] = useState<{
    open: boolean;
    type: 'glucose' | 'bp';
  }>({
    open: false,
    type: 'glucose',
  });

  const today = todayInAppTz();
  const userId = user?.id || profile?.user_id || '';
  const profileId = profile?.id || userId;

  const loadDashboard = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const streakFrom = addDaysAppTz(today, -60);

      const [meds, doses, orders, reports, visits, glucose, bp] = await Promise.all([
        medicinesRepo.listMedicines(profileId),
        dosesRepo.listDosesForRange(profileId, streakFrom, today),
        testOrdersRepo.listPendingTestOrders(profileId),
        reportsRepo.listReports(profileId),
        visitsRepo.listVisits(profileId),
        listGlucoseReadings(profileId),
        listBloodPressureReadings(profileId),
      ]);

      const map: Record<string, Tables<'medicines'>> = {};
      for (const m of meds) map[m.id] = m;
      setMedsMap(map);
      setActiveMedsList(activeMedicines(meds, today));

      setStreakDoses(doses);
      setTodayDoses(doses.filter((d) => d.scheduled_date === today));
      setPendingOrders(orders);
      setRecordCounts({ reports: reports.length, visits: visits.length });
      setGlucoseLogs(glucose);
      setBpLogs(bp);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setLoadError('Your dashboard could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [profileId, today]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleMarkTaken = async (dose: Tables<'doses'>) => {
    const prev = todayDoses;
    const nowIso = new Date().toISOString();
    setTodayDoses((curr) =>
      curr.map((d) => (d.id === dose.id ? { ...d, status: 'taken', taken_at: nowIso } : d))
    );

    try {
      await dosesRepo.updateDoseStatus(dose.id, 'taken', nowIso);
      decrementPill(profileId, dose.medicine_id);
      setToast({ message: 'Dose logged as taken', tone: 'ok' });
    } catch {
      setTodayDoses(prev);
      setToast({ message: 'Could not log dose. Check connection.', tone: 'risk' });
    }
  };

  const toDoseRecord = (d: Tables<'doses'>) => ({
    id: d.id,
    medicine_id: d.medicine_id,
    scheduled_date: d.scheduled_date,
    scheduled_minutes: d.scheduled_minutes,
    status: d.status,
    taken_at: d.taken_at,
    is_prn: isPrnMedicine(medsMap[d.medicine_id]),
  });

  const adherence = calculateAdherence(
    todayDoses.map(toDoseRecord),
    { from: today, to: today },
    new Date()
  );
  const streakDays = calculateAdherenceStreak(streakDoses.map(toDoseRecord), new Date());

  const hasScheduledToday = adherence.scheduled > 0;
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  const nowMinutes = minutesInAppTz();
  const outstanding = todayDoses
    .filter((d) => {
      const status = deriveStatusOnRead(d, new Date());
      return status === 'pending' || status === 'missed';
    })
    .sort((a, b) => a.scheduled_minutes - b.scheduled_minutes);
  const nextDose = outstanding.find((d) => d.scheduled_minutes >= nowMinutes) ?? outstanding[0];
  const nextMedicine = nextDose ? medsMap[nextDose.medicine_id] : undefined;

  const remainingToday = outstanding.length;
  const takenToday = todayDoses.filter((d) => d.status === 'taken').length;

  // Latest Vitals Computation
  const latestGlucose = glucoseLogs[0];
  const latestBp = bpLogs[0];

  const glucoseEval = useMemo(() => {
    if (!latestGlucose) return null;
    return evaluateGlucose(latestGlucose.value_mg_dl, latestGlucose.type);
  }, [latestGlucose]);

  const bpEval = useMemo(() => {
    if (!latestBp) return null;
    return evaluateBloodPressure(latestBp.systolic, latestBp.diastolic);
  }, [latestBp]);

  const bpMapValue = useMemo(() => {
    if (!latestBp) return null;
    return calculateMap(latestBp.systolic, latestBp.diastolic);
  }, [latestBp]);

  // Low stock inventory pills check from local inventory store
  const lowStockMedicines = useMemo(() => {
    if (!profileId) return [];
    const inventory = readInventory(profileId);
    return activeMedsList.filter((m) => {
      const count = inventory[m.id];
      return typeof count === 'number' && count <= 5;
    });
  }, [activeMedsList, profileId]);

  // Adherence achievements
  const achievements = evaluateAchievements({
    adherenceStreakDays: streakDays,
    totalPrescriptions: activeMedsList.length,
    totalReports: recordCounts.reports,
    totalVisits: recordCounts.visits,
    glucoseLogsCount: glucoseLogs.length,
    inRangeGlucoseCount: glucoseLogs.filter(
      (g) => evaluateGlucose(g.value_mg_dl, g.type).status === 'normal'
    ).length,
    bpLogsCount: bpLogs.length,
    normalBpCount: bpLogs.filter(
      (b) => evaluateBloodPressure(b.systolic, b.diastolic).stage === 'normal'
    ).length,
  });
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12
      ? 'Good morning'
      : currentHour < 17
        ? 'Good afternoon'
        : 'Good evening';

  return (
    <AppShell>
      <Toast
        open={Boolean(toast)}
        message={toast?.message || ''}
        tone={toast?.tone || 'ok'}
        onClose={() => setToast(null)}
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Top Greeting & Action Header */}
        <motion.div
          variants={staggerItem}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-content tracking-tight">
                {timeGreeting}, {firstName}
              </h1>
              {streakDays > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-accent-subtle text-accent text-xs font-bold border border-accent/20">
                  <FlameIcon size={13} className="text-accent" />
                  {streakDays}d Streak
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-content-muted">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-raised text-content-muted font-medium border border-line">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Pakistan Standard Time
              </span>
              <span>•</span>
              <span className="font-medium">{formatDayHeading(today)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/prescriptions/new">
              <Button leftIcon={<PrescriptionIcon size={16} />} className="shadow-xs hover:shadow-md">
                Add Prescription
              </Button>
            </Link>
            <Link to="/assistant">
              <Button variant="secondary" leftIcon={<SparklesIcon size={16} />}>
                Assistant
              </Button>
            </Link>
          </div>
        </motion.div>

        {loadError ? (
          <ErrorState
            title="Dashboard didn't load"
            message={loadError}
            onRetry={loadDashboard}
            className="mb-8"
          />
        ) : (
          <>
            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 1: MEDICATION & ADHERENCE COMMAND CENTER (HERO)
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="medication-hub-heading">
              <h2 id="medication-hub-heading" className="sr-only">
                Medication & Adherence Command Center
              </h2>

              {isLoading ? (
                <Skeleton className="h-44 w-full rounded-[var(--radius-xl)]" />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  {/* Next Scheduled Dose Hero (8 Columns) */}
                  <div className="lg:col-span-8 flex">
                    {nextDose ? (
                      <Card className="p-5 sm:p-6 bg-surface-raised border border-line shadow-card hover:shadow-raise transition-all relative overflow-hidden flex flex-col justify-between w-full">
                        <span
                          className="absolute inset-y-0 left-0 w-1.5 bg-accent"
                          aria-hidden="true"
                        />

                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-accent-subtle text-accent border border-accent/20 flex items-center justify-center shrink-0">
                                <MedicineIcon size={24} />
                              </div>
                              <div>
                                <span className="text-2xs uppercase tracking-wider font-bold text-accent">
                                  Next Scheduled Dose
                                </span>
                                <h3 className="text-xl font-black text-content tracking-tight">
                                  {nextMedicine?.medicine_name || 'Prescribed medicine'}
                                </h3>
                                <p className="text-xs text-content-muted mt-0.5">
                                  {[nextMedicine?.strength, nextMedicine?.dose_amount]
                                    .filter(Boolean)
                                    .join(' · ') || 'Take as prescribed'}
                                </p>
                              </div>
                            </div>

                            {/* Due Time Badge */}
                            <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-content-onaccent font-bold text-xs font-mono shadow-xs">
                              <ClockIcon size={14} />
                              <span>{formatDoseTime(nextDose.scheduled_minutes)}</span>
                            </div>
                          </div>

                          {/* Meal & Clinical Instructions */}
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-surface-sunken text-content-muted border border-line font-medium">
                              <span className="text-accent">
                                {mealRelationIcon(mealRelationOf(nextMedicine?.with_food), 13)}
                              </span>
                              <span>{mealRelationInstruction(nextMedicine?.with_food)}</span>
                            </span>
                          </div>

                          {nextMedicine?.instructions && (
                            <p className="mt-2.5 text-xs text-content-muted bg-surface-sunken/80 border border-line rounded-lg px-3 py-2 leading-relaxed">
                              <span className="font-semibold text-content">Instructions: </span>
                              {nextMedicine.instructions}
                            </p>
                          )}
                        </div>

                        {/* Quick 1-Tap Take Action */}
                        <div className="mt-5 pt-3 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <p className="text-xs text-content-muted">
                            {remainingToday} dose{remainingToday === 1 ? '' : 's'} remaining today
                          </p>
                          <Button
                            size="md"
                            variant="primary"
                            onClick={() => handleMarkTaken(nextDose)}
                            leftIcon={<CheckIcon size={16} className="stroke-[2.5]" />}
                            className="font-bold shadow-xs hover:shadow-md"
                          >
                            Take Dose Now
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <Card className="p-6 bg-surface-raised border border-line shadow-card flex flex-col justify-center w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <span className="shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-ok-bg text-ok-text border border-ok-border">
                            <CheckIcon size={24} className="stroke-[2.5]" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-content">
                              {hasScheduledToday
                                ? 'All doses completed for today!'
                                : activeMedsList.length > 0
                                  ? 'Nothing due right now'
                                  : 'No active medicine courses scheduled'}
                            </p>
                            <p className="mt-1 text-xs text-content-muted">
                              {hasScheduledToday
                                ? `You completed all ${takenToday} scheduled doses today. Outstanding consistency!`
                                : activeMedsList.length > 0
                                  ? 'Your next scheduled dose will show up here automatically.'
                                  : 'Scan or enter a prescription to generate your automated timetable.'}
                            </p>
                          </div>
                          {activeMedsList.length === 0 && (
                            <Link to="/prescriptions/new" className="shrink-0">
                              <Button leftIcon={<PrescriptionIcon size={16} />}>Scan Prescription</Button>
                            </Link>
                          )}
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Today's Adherence Ring (4 Columns) */}
                  <div className="lg:col-span-4 flex">
                    <Card className="p-5 sm:p-6 bg-surface-raised border border-line shadow-card flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle">
                            Today's Adherence
                          </span>
                          {streakDays > 0 && (
                            <span className="text-2xs font-bold text-accent flex items-center gap-1">
                              <FlameIcon size={12} /> {streakDays}d streak
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <ProgressRing
                            percentage={hasScheduledToday ? adherence.percentage : 0}
                            size={64}
                            strokeWidth={6.5}
                            tone={
                              adherence.percentage === 100
                                ? 'ok'
                                : adherence.percentage >= 50
                                  ? 'ok'
                                  : 'warn'
                            }
                          />
                          <div>
                            <p className="text-lg font-black text-content leading-snug">
                              {takenToday} of {takenToday + remainingToday} taken
                            </p>
                            <p className="mt-0.5 text-xs text-content-muted">
                              {hasScheduledToday
                                ? `${adherence.percentage}% daily adherence`
                                : 'No doses scheduled'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Link
                        to="/medicines"
                        className="mt-5 pt-3 border-t border-line inline-flex items-center justify-between text-xs font-bold text-accent hover:text-accent-hover transition-colors"
                      >
                        <span>Open full timetable</span>
                        <ArrowRightIcon size={14} />
                      </Link>
                    </Card>
                  </div>
                </div>
              )}
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 2: INTERACTIVE VITALS & BIOMETRICS BENTO
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="vitals-bento-heading">
              <div className="flex items-center justify-between mb-3">
                <SectionHeader
                  title="Biometrics & Chronic Vitals"
                  icon={<ActivityIcon size={16} />}
                />
                <Link
                  to="/vitals"
                  className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                >
                  Vitals Radar <ArrowRightIcon size={13} />
                </Link>
              </div>
              <h2 id="vitals-bento-heading" className="sr-only">
                Biometrics & Chronic Vitals Bento
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Blood Glucose Card (6 Columns) */}
                <Card className="p-5 bg-surface-raised border border-line shadow-card hover:border-line-strong transition-all flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-line">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                          <DropletIcon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-content">Blood Glucose</h3>
                          <p className="text-2xs text-content-subtle">
                            {latestGlucose
                              ? `Last checked: ${formatReadingTime(latestGlucose.measured_at)}`
                              : 'No readings logged'}
                          </p>
                        </div>
                      </div>

                      {glucoseEval && (
                        <Badge tone={VITAL_TONE[glucoseEval.tone].badge} size="sm" withIcon>
                          {glucoseEval.label}
                        </Badge>
                      )}
                    </div>

                    {/* Value Preview */}
                    {latestGlucose ? (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-content tracking-tight font-mono">
                            {latestGlucose.value_mg_dl}
                          </span>
                          <span className="text-xs font-bold text-content-muted">mg/dL</span>
                          <span className="ml-auto text-xs px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content-muted font-medium capitalize">
                            {latestGlucose.type.replace('_', ' ')}
                          </span>
                        </div>

                        {glucoseEval && (
                          <p className="text-xs text-content-muted bg-surface-sunken/60 border border-line rounded-lg px-3 py-2 leading-relaxed">
                            {glucoseEval.advice}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 py-4 text-center rounded-xl bg-surface-sunken/40 border border-line/60">
                        <p className="text-xs font-semibold text-content-muted">
                          No glucose readings logged yet
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">
                          Track fasting and post-meal targets regularly
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<PlusIcon size={14} />}
                      onClick={() =>
                        setQuickVitalsModal({ open: true, type: 'glucose' })
                      }
                      className="font-bold"
                    >
                      Log Blood Sugar
                    </Button>
                    <Link
                      to="/vitals"
                      className="text-2xs font-bold text-content-muted hover:text-accent transition-colors flex items-center gap-1"
                    >
                      <span>Full Trends</span>
                      <ArrowRightIcon size={12} />
                    </Link>
                  </div>
                </Card>

                {/* 2. Blood Pressure Card (6 Columns) */}
                <Card className="p-5 bg-surface-raised border border-line shadow-card hover:border-line-strong transition-all flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-line">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
                          <HeartPulseIcon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-content">Blood Pressure</h3>
                          <p className="text-2xs text-content-subtle">
                            {latestBp
                              ? `Last checked: ${formatReadingTime(latestBp.measured_at)}`
                              : 'No readings logged'}
                          </p>
                        </div>
                      </div>

                      {bpEval && (
                        <Badge tone={VITAL_TONE[bpEval.tone].badge} size="sm" withIcon>
                          {bpEval.label}
                        </Badge>
                      )}
                    </div>

                    {/* Value Preview */}
                    {latestBp ? (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-content tracking-tight font-mono">
                            {latestBp.systolic}/{latestBp.diastolic}
                          </span>
                          <span className="text-xs font-bold text-content-muted">mmHg</span>

                          <div className="ml-auto flex items-center gap-2">
                            {latestBp.pulse_bpm && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold font-mono flex items-center gap-1">
                                <HeartPulseIcon size={11} />
                                {latestBp.pulse_bpm} bpm
                              </span>
                            )}
                            {bpMapValue && (
                              <span className="text-2xs px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content-muted font-medium">
                                MAP {bpMapValue}
                              </span>
                            )}
                          </div>
                        </div>

                        {bpEval && (
                          <p className="text-xs text-content-muted bg-surface-sunken/60 border border-line rounded-lg px-3 py-2 leading-relaxed">
                            {bpEval.advice}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 py-4 text-center rounded-xl bg-surface-sunken/40 border border-line/60">
                        <p className="text-xs font-semibold text-content-muted">
                          No blood pressure readings logged yet
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">
                          Track systolic, diastolic & pulse regularly
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<PlusIcon size={14} />}
                      onClick={() =>
                        setQuickVitalsModal({ open: true, type: 'bp' })
                      }
                      className="font-bold"
                    >
                      Log Blood Pressure
                    </Button>
                    <Link
                      to="/vitals"
                      className="text-2xs font-bold text-content-muted hover:text-accent transition-colors flex items-center gap-1"
                    >
                      <span>Full Trends</span>
                      <ArrowRightIcon size={12} />
                    </Link>
                  </div>
                </Card>
              </div>
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 3: CLINICAL GUIDANCE & LAB DIAGNOSTICS OVERVIEW
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="clinical-guidance-bento-heading">
              <h2 id="clinical-guidance-bento-heading" className="sr-only">
                Clinical Guidance and Lab Diagnostics
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Clinical Guidance Assistant Launchpad (7 Columns) */}
                <Card className="lg:col-span-7 p-5 bg-gradient-to-br from-surface-raised to-accent-subtle/30 border border-line shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-accent text-content-onaccent flex items-center justify-center shadow-xs">
                          <SparklesIcon size={16} />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-content">
                            Clinical Assistant & Guidance
                          </h3>
                          <p className="text-2xs text-content-muted">
                            Insights grounded directly in your prescriptions and records
                          </p>
                        </div>
                      </div>
                      <Badge tone="info" size="sm">
                        24/7 Support
                      </Badge>
                    </div>

                    <p className="text-xs text-content-muted mt-2">
                      Review medication interactions, understand dosage instructions, or prepare
                      for upcoming consultations.
                    </p>

                    {/* Quick Query Launchpad Pills */}
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {[
                        { label: '💊 Check Drug Interactions', path: '/assistant' },
                        { label: '🩺 Prepare Doctor Brief', path: '/doctor/brief' },
                        { label: '❓ Consultation Questions', path: '/doctor/questions' },
                        { label: '⚡ Symptom Triage', path: '/symptoms' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => navigate(item.path)}
                          className="px-3 py-1.5 rounded-xl bg-surface text-xs font-semibold text-content border border-line hover:border-accent hover:text-accent shadow-2xs transition-all cursor-pointer text-left"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-2xs text-content-subtle">
                      Private & encrypted medical dossier
                    </span>
                    <Link
                      to="/assistant"
                      className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1"
                    >
                      <span>Open Assistant</span>
                      <ArrowRightIcon size={13} />
                    </Link>
                  </div>
                </Card>

                {/* Diagnostic Labs & Records (5 Columns) */}
                <Card className="lg:col-span-5 p-5 bg-surface-raised border border-line shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-line">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-surface-sunken text-content-muted border border-line flex items-center justify-center">
                          <LabFlaskIcon size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-content">Labs & Reports</h3>
                          <p className="text-2xs text-content-subtle">
                            Diagnostic orders & tests
                          </p>
                        </div>
                      </div>

                      {pendingOrders.length > 0 && (
                        <Badge tone="warn" size="sm">
                          {pendingOrders.length} Due
                        </Badge>
                      )}
                    </div>

                    {pendingOrders.length > 0 ? (
                      <div className="mt-2.5 space-y-2">
                        <span className="text-2xs font-bold uppercase tracking-wider text-content-subtle">
                          Outstanding Test Orders
                        </span>
                        {pendingOrders.slice(0, 2).map((order) => (
                          <div
                            key={order.id}
                            className="p-2.5 rounded-xl bg-surface-sunken/80 border border-line flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-content truncate">
                                {order.test_name}
                              </p>
                              <p className="text-2xs text-content-subtle truncate">
                                {order.notes || `Ordered on ${order.ordered_date}`}
                              </p>
                            </div>
                            <Badge tone="warn" size="sm">
                              Pending
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-3 rounded-xl bg-surface-sunken/60 border border-line">
                            <span className="text-lg font-black text-content font-mono block">
                              {recordCounts.reports}
                            </span>
                            <span className="text-2xs text-content-muted">Lab Reports</span>
                          </div>
                          <div className="p-3 rounded-xl bg-surface-sunken/60 border border-line">
                            <span className="text-lg font-black text-content font-mono block">
                              {recordCounts.visits}
                            </span>
                            <span className="text-2xs text-content-muted">Doctor Visits</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <Link to="/reports/new">
                      <Button size="sm" variant="secondary" leftIcon={<PlusIcon size={14} />}>
                        Upload Lab Report
                      </Button>
                    </Link>
                    <Link
                      to="/reports"
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      View All <ArrowRightIcon size={12} />
                    </Link>
                  </div>
                </Card>
              </div>
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 4: CLINICAL CARE CONTINUUM & TOOLS
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="clinical-tools-heading">
              <SectionHeader title="Clinical Care Continuum" className="mb-3" />
              <h2 id="clinical-tools-heading" className="sr-only">
                Clinical Care Continuum
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Tool 1: Doctor Visit Prep */}
                <Link
                  to="/doctor/questions"
                  className="group flex flex-col justify-between p-4 rounded-2xl border border-line bg-surface-raised hover:border-line-strong hover:shadow-raise transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-accent-subtle text-accent border border-accent/20">
                      <QuestionIcon size={18} />
                    </span>
                    <div>
                      <span className="block text-sm font-bold text-content">Doctor Visit Prep</span>
                      <span className="block text-2xs text-content-subtle">Smart questions & agenda</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line/60 text-2xs font-bold text-accent">
                    <span>Prepare dossier</span>
                    <ArrowRightIcon size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>

                {/* Tool 2: Second Opinion Pack */}
                <Link
                  to="/doctor/second-opinion"
                  className="group flex flex-col justify-between p-4 rounded-2xl border border-line bg-surface-raised hover:border-line-strong hover:shadow-raise transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      <FileTextIcon size={18} />
                    </span>
                    <div>
                      <span className="block text-sm font-bold text-content">Second Opinion</span>
                      <span className="block text-2xs text-content-subtle">Anonymised clinical export</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line/60 text-2xs font-bold text-accent">
                    <span>Export pack</span>
                    <ArrowRightIcon size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>

                {/* Tool 3: Longitudinal Health Timeline */}
                <Link
                  to="/timeline"
                  className="group flex flex-col justify-between p-4 rounded-2xl border border-line bg-surface-raised hover:border-line-strong hover:shadow-raise transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
                      <CalendarIcon size={18} />
                    </span>
                    <div>
                      <span className="block text-sm font-bold text-content">Health Timeline</span>
                      <span className="block text-2xs text-content-subtle">Longitudinal health journey</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line/60 text-2xs font-bold text-accent">
                    <span>View timeline</span>
                    <ArrowRightIcon size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>

                {/* Tool 4: Medicine Cabinet & Low Stock Alerts */}
                <Link
                  to="/medicines/cabinet"
                  className="group flex flex-col justify-between p-4 rounded-2xl border border-line bg-surface-raised hover:border-line-strong hover:shadow-raise transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      <CabinetIcon size={18} />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-sm font-bold text-content">Medicine Cabinet</span>
                      <span className="block text-2xs text-content-subtle truncate">
                        {lowStockMedicines.length > 0
                          ? `${lowStockMedicines.length} low stock refill`
                          : `${activeMedsList.length} active courses`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-line/60 text-2xs font-bold text-accent">
                    {lowStockMedicines.length > 0 ? (
                      <span className="text-warn font-bold flex items-center gap-1">
                        <AlertTriangleIcon size={11} /> Refills Needed
                      </span>
                    ) : (
                      <span>Manage Cabinet</span>
                    )}
                    <ArrowRightIcon size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              </div>
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 5: MILESTONES & EMERGENCY HOTLINES
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="milestones-heading">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Milestones Card (8 Columns) */}
                <div className="lg:col-span-8">
                  <div className="flex items-center justify-between mb-3">
                    <SectionHeader
                      title="Adherence Milestones"
                      icon={<MedalIcon size={16} />}
                      meta={`${unlockedCount} of ${achievements.length} earned`}
                    />
                  </div>

                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-xl)]" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {achievements.slice(0, 4).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          disabled={!a.unlocked}
                          onClick={() => a.unlocked && setSelectedMilestone(a)}
                          className={
                            a.unlocked
                              ? 'cursor-pointer text-left w-full transition-transform hover:-translate-y-0.5'
                              : 'text-left w-full cursor-default'
                          }
                        >
                          <MilestoneBadgeCard achievement={a} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Emergency Hotlines Card (4 Columns) */}
                <div className="lg:col-span-4 flex flex-col">
                  <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle mb-3 block">
                    Emergency Response (Pakistan)
                  </span>

                  <Card accent="risk" className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-risk-bg text-risk-text border border-risk-border">
                          <EmergencyAmbulanceIcon size={18} />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-content">Emergency Quick Dial</h3>
                          <p className="text-2xs text-content-muted">Tap to call directly</p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        {EMERGENCY_NUMBERS.map((line) => (
                          <a
                            key={line.tel}
                            href={`tel:${line.tel}`}
                            className="flex items-center justify-between px-3 py-2 rounded-xl border border-risk-border/60 bg-risk-bg/60 hover:bg-risk-bg text-risk-text transition-all"
                          >
                            <span className="text-xs font-bold">{line.label}</span>
                            <span className="text-xs font-black font-mono" data-numeric>
                              {line.tel}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>

                    <p className="text-3xs text-content-subtle mt-3 text-center">
                      Works offline without active internet connection
                    </p>
                  </Card>
                </div>
              </div>
            </motion.section>
          </>
        )}
      </motion.div>

      {/* Quick Vitals Logger Modal */}
      <QuickVitalsModal
        open={quickVitalsModal.open}
        initialType={quickVitalsModal.type}
        onClose={() => setQuickVitalsModal({ open: false, type: 'glucose' })}
        onSaved={loadDashboard}
      />

      {/* Milestone Celebration Modal */}
      {selectedMilestone && (
        <MilestoneCelebrationModal
          isOpen={!!selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          title={selectedMilestone.title}
          description={selectedMilestone.description}
          streakCount={selectedMilestone.id.includes('streak') ? streakDays : undefined}
        />
      )}
    </AppShell>
  );
}
