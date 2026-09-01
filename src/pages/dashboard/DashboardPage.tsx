import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ErrorState } from '../../components/ui/ErrorState';
import { MetricCard } from '../../components/ui/MetricCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Toast } from '../../components/ui/Toast';
import { MilestoneBadgeCard } from '../../components/ui/MilestoneBadgeCard';
import { MilestoneCelebrationModal } from '../../components/ui/MilestoneCelebrationModal';
import { SLOT_META, mealRelationIcon } from '../../components/ui/slotMeta';
import {
  PrescriptionIcon,
  LabFlaskIcon,
  MedicineIcon,
  MedalIcon,
  DropletIcon,
  QuestionIcon,
  FileTextIcon,
  EmergencyAmbulanceIcon,
  ArrowRightIcon,
  ClockIcon,
  SparklesIcon,
  CheckIcon,
  FlameIcon,
  ActivityIcon,
} from '../../components/ui/icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, dosesRepo, testOrdersRepo, reportsRepo, visitsRepo } from '../../lib/db';
import { listGlucoseReadings, listBloodPressureReadings } from '../../lib/db/vitals';
import { decrementPill, incrementPill } from '../../lib/inventory';
import { activeMedicines } from '../../domain/activeMedicines';
import { evaluateAchievements, type Achievement } from '../../domain/achievements';
import { calculateAdherence, calculateAdherenceStreak, deriveStatusOnRead } from '../../domain/adherence';
import { evaluateGlucose, evaluateBloodPressure } from '../../domain/vitals';
import { bucketOf } from '../../domain/timeBuckets';
import { mealRelationOf, mealRelationInstruction } from '../../domain/mealRelation';
import { todayInAppTz, addDaysAppTz, formatDoseTime, minutesInAppTz, formatDayHeading } from '../../lib/time';
import { staggerContainer, staggerItem } from '../../lib/motion';
import type { Tables } from '../../lib/supabase/types';

/** PRN doses are excluded from adherence: they are taken as needed, not on schedule. */
function isPrnMedicine(medicine: Tables<'medicines'> | undefined): boolean {
  return medicine?.frequency_code === 'PRN' || medicine?.frequency_code === 'SOS';
}

const EMERGENCY_NUMBERS = [
  { tel: '1122', label: 'Rescue' },
  { tel: '115', label: 'Edhi' },
  { tel: '1020', label: 'Chhipa' },
];

export function DashboardPage() {
  const { user, profile } = useAuth();
  const [activeMedsList, setActiveMedsList] = useState<Tables<'medicines'>[]>([]);
  const [medsMap, setMedsMap] = useState<Record<string, Tables<'medicines'>>>({});
  const [todayDoses, setTodayDoses] = useState<Tables<'doses'>[]>([]);
  const [streakDoses, setStreakDoses] = useState<Tables<'doses'>[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Tables<'test_orders'>[]>([]);
  const [recordCounts, setRecordCounts] = useState({ reports: 0, visits: 0 });
  const [vitalStats, setVitalStats] = useState({
    glucoseLogs: 0,
    inRangeGlucose: 0,
    bpLogs: 0,
    normalBp: 0,
    recentBpStatus: 'No logs yet',
    recentGlucoseStatus: 'No logs yet',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<Achievement | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'risk' } | null>(null);

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

      const lastBp = bp[0];
      const lastGlucose = glucose[0];

      setVitalStats({
        glucoseLogs: glucose.length,
        inRangeGlucose: glucose.filter(
          (g) => evaluateGlucose(g.value_mg_dl, g.type).status === 'normal'
        ).length,
        bpLogs: bp.length,
        normalBp: bp.filter(
          (b) => evaluateBloodPressure(b.systolic, b.diastolic).stage === 'normal'
        ).length,
        recentBpStatus: lastBp
          ? `${lastBp.systolic}/${lastBp.diastolic} mmHg (${evaluateBloodPressure(lastBp.systolic, lastBp.diastolic).label})`
          : 'No logs yet',
        recentGlucoseStatus: lastGlucose
          ? `${lastGlucose.value_mg_dl} mg/dL (${lastGlucose.type})`
          : 'No logs yet',
      });
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

  const handleUndo = async (dose: Tables<'doses'>) => {
    const prev = todayDoses;
    const previousStatus = dose.status;

    setTodayDoses((curr) =>
      curr.map((d) =>
        d.id === dose.id
          ? { ...d, status: 'pending', taken_at: null, skipped_reason: null }
          : d
      )
    );

    try {
      await dosesRepo.updateDoseStatus(dose.id, 'pending', null, null);
      if (previousStatus === 'taken') {
        incrementPill(profileId, dose.medicine_id);
      }
      setToast({ message: 'Dose reset to pending', tone: 'ok' });
    } catch {
      setTodayDoses(prev);
      setToast({ message: 'Could not undo dose status.', tone: 'risk' });
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

  const achievements = evaluateAchievements({
    adherenceStreakDays: streakDays,
    totalPrescriptions: activeMedsList.length,
    totalReports: recordCounts.reports,
    totalVisits: recordCounts.visits,
    glucoseLogsCount: vitalStats.glucoseLogs,
    inRangeGlucoseCount: vitalStats.inRangeGlucose,
    bpLogsCount: vitalStats.bpLogs,
    normalBpCount: vitalStats.normalBp,
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
        className="space-y-8"
      >
        {/* Top Greeting & Action Header */}
        <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
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
            {/* ── Medication Command Center (Hero Section) ─────────────────────── */}
            <motion.section variants={staggerItem} aria-labelledby="medication-hub-heading">
              <h2 id="medication-hub-heading" className="sr-only">
                Medication Command Center
              </h2>

              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-[var(--radius-xl)]" />
              ) : nextDose ? (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-stretch">
                  {/* Active Next Dose Card with Direct 1-Tap Logging */}
                  <Card className="p-5 sm:p-6 bg-surface-raised border border-line shadow-card hover:shadow-raise transition-all relative overflow-hidden flex flex-col justify-between">
                    <span
                      className="absolute inset-y-0 left-0 w-1.5 bg-accent"
                      aria-hidden="true"
                    />

                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-accent-subtle text-accent border border-accent/20 flex items-center justify-center shrink-0">
                            <MedicineIcon size={22} />
                          </div>
                          <div>
                            <span className="text-2xs uppercase tracking-wider font-bold text-accent">
                              Next Scheduled Dose
                            </span>
                            <h3 className="text-lg sm:text-xl font-black text-content tracking-tight">
                              {nextMedicine?.medicine_name || 'Prescribed medicine'}
                            </h3>
                            <p className="text-xs text-content-muted mt-0.5">
                              {[nextMedicine?.strength, nextMedicine?.dose_amount].filter(Boolean).join(' · ') || 'Dose as prescribed'}
                            </p>
                          </div>
                        </div>

                        {/* Due Time Badge */}
                        <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-content-onaccent font-bold text-xs font-mono shadow-xs">
                          <ClockIcon size={14} />
                          <span>{formatDoseTime(nextDose.scheduled_minutes)}</span>
                        </div>
                      </div>

                      {/* Meal & Instructions */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-surface-sunken text-content-muted border border-line font-medium">
                          <span className="text-accent">{mealRelationIcon(mealRelationOf(nextMedicine?.with_food), 13)}</span>
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

                    {/* Quick 1-Tap Take Action on Dashboard */}
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

                  {/* Adherence Ring & Quick Link */}
                  <Card className="lg:w-72 p-5 sm:p-6 bg-surface-raised border border-line shadow-card flex flex-col justify-between">
                    <div>
                      <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle block mb-3">
                        Today's Progress
                      </span>
                      <div className="flex items-center gap-4">
                        <ProgressRing
                          percentage={hasScheduledToday ? adherence.percentage : 0}
                          size={64}
                          strokeWidth={6.5}
                          tone={adherence.percentage === 100 ? 'ok' : adherence.percentage >= 50 ? 'ok' : 'warn'}
                        />
                        <div>
                          <p className="text-base font-bold text-content leading-snug">
                            {takenToday} of {takenToday + remainingToday} taken
                          </p>
                          <p className="mt-0.5 text-xs text-content-muted">
                            {hasScheduledToday ? `${adherence.percentage}% complete` : 'No scheduled doses'}
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
              ) : (
                <Card className="p-6 bg-surface-raised border border-line shadow-card">
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
                          ? `You completed all ${takenToday} scheduled doses today. Keep up the great consistency!`
                          : activeMedsList.length > 0
                            ? 'Your next scheduled doses will show up here automatically.'
                            : 'Scan or enter a prescription to generate your automated medication schedule.'}
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
            </motion.section>

            {/* ── At a glance Metric Cards ───────────────────────────────────── */}
            <motion.section variants={staggerItem} aria-labelledby="glance-heading">
              <SectionHeader
                title="Health at a glance"
                icon={<ActivityIcon size={16} />}
                className="mb-4"
              />
              <h2 id="glance-heading" className="sr-only">
                Health at a glance
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Active medicines"
                  value={isLoading ? '—' : activeMedsList.length}
                  detail={`${activeMedsList.length} active course${activeMedsList.length === 1 ? '' : 's'}`}
                  icon={<MedicineIcon size={18} />}
                  to="/medicines/cabinet"
                />
                <MetricCard
                  label="Adherence streak"
                  value={isLoading ? '—' : `${streakDays} ${streakDays === 1 ? 'day' : 'days'}`}
                  detail={streakDays > 0 ? 'Consecutive complete days' : 'Take all daily doses to start'}
                  tone={streakDays > 0 ? 'ok' : 'neutral'}
                  icon={<FlameIcon size={18} />}
                />
                <MetricCard
                  label="Blood pressure & sugar"
                  value={isLoading ? '—' : vitalStats.bpLogs + vitalStats.glucoseLogs > 0 ? `${vitalStats.bpLogs + vitalStats.glucoseLogs} logs` : 'Log now'}
                  detail={vitalStats.recentBpStatus}
                  icon={<DropletIcon size={18} />}
                  to="/vitals"
                />
                <MetricCard
                  label="Pending labs & orders"
                  value={isLoading ? '—' : pendingOrders.length}
                  detail={pendingOrders[0]?.test_name || 'No outstanding tests'}
                  tone={pendingOrders.length > 0 ? 'warn' : 'neutral'}
                  icon={<LabFlaskIcon size={18} />}
                  to="/reports"
                  trailing={
                    pendingOrders.length > 0 ? (
                      <Badge tone="warn" size="sm">
                        Due
                      </Badge>
                    ) : undefined
                  }
                />
              </div>
            </motion.section>

            {/* ── Today's Routine Checklist ──────────────────────────────────── */}
            {!isLoading && todayDoses.length > 0 && (
              <motion.section variants={staggerItem} aria-labelledby="rest-of-day-heading">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader
                    title="Today's Schedule Routine"
                    meta={`${takenToday}/${todayDoses.length} completed`}
                    icon={<ClockIcon size={16} />}
                  />
                  <Link
                    to="/medicines"
                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    Manage Timetable <ArrowRightIcon size={13} />
                  </Link>
                </div>
                <h2 id="rest-of-day-heading" className="sr-only">
                  Today's Schedule Routine
                </h2>

                <div className="rounded-[var(--radius-xl)] border border-line bg-surface-raised overflow-hidden divide-y divide-line shadow-card">
                  {todayDoses
                    .slice()
                    .sort((a, b) => a.scheduled_minutes - b.scheduled_minutes)
                    .map((dose) => {
                      const med = medsMap[dose.medicine_id];
                      const status = deriveStatusOnRead(dose, new Date());
                      const slot = SLOT_META[bucketOf(dose.scheduled_minutes)];
                      const isTaken = status === 'taken';

                      return (
                        <div
                          key={dose.id}
                          className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-hover/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-xl border ${slot.surface} ${slot.text} ${slot.border}`}
                            >
                              {slot.icon(15)}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate ${isTaken ? 'text-content-muted line-through' : 'text-content'}`}>
                                {med?.medicine_name || 'Prescribed medicine'}
                                {med?.strength ? ` · ${med.strength}` : ''}
                              </p>
                              <div className="flex items-center gap-2 text-2xs text-content-subtle mt-0.5">
                                <span data-numeric className="font-mono font-medium">
                                  {formatDoseTime(dose.scheduled_minutes)}
                                </span>
                                <span>•</span>
                                <span>{slot.label}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isTaken ? (
                              <div className="flex items-center gap-2">
                                <Badge tone="ok" size="sm" withIcon>
                                  <CheckIcon size={11} className="inline mr-0.5" /> Taken
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() => handleUndo(dose)}
                                  className="text-2xs text-content-subtle hover:text-content font-medium px-2 py-1 rounded transition-colors cursor-pointer"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : status === 'missed' ? (
                              <div className="flex items-center gap-2">
                                <Badge tone="warn" size="sm">
                                  Overdue
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleMarkTaken(dose)}
                                >
                                  Take
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleMarkTaken(dose)}
                              >
                                Take
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.section>
            )}

            {/* ── Quick Tools ────────────────────────────────────────────────── */}
            <motion.section variants={staggerItem} aria-labelledby="tools-heading">
              <SectionHeader title="Clinical Quick Tools" className="mb-4" />
              <h2 id="tools-heading" className="sr-only">
                Clinical Quick Tools
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    to: '/vitals',
                    icon: <DropletIcon size={19} />,
                    title: 'Sugar & Blood Pressure',
                    detail: 'Log and monitor vital signs',
                  },
                  {
                    to: '/doctor/questions',
                    icon: <QuestionIcon size={19} />,
                    title: 'Doctor Visit Prep',
                    detail: 'Questions & symptom dossier',
                  },
                  {
                    to: '/doctor/second-opinion',
                    icon: <FileTextIcon size={19} />,
                    title: 'Second Opinion Pack',
                    detail: 'Anonymised clinical export',
                  },
                ].map((tool) => (
                  <Link
                    key={tool.to}
                    to={tool.to}
                    className="group flex items-center gap-3.5 p-4 rounded-[var(--radius-xl)] border border-line bg-surface-raised hover:border-line-strong hover:shadow-raise transition-all"
                  >
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-accent-subtle text-accent border border-accent/20">
                      {tool.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-content truncate">
                        {tool.title}
                      </span>
                      <span className="block text-xs text-content-subtle mt-0.5">{tool.detail}</span>
                    </span>
                    <ArrowRightIcon
                      size={15}
                      className="ml-auto shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                ))}
              </div>
            </motion.section>

            {/* ── Milestones & Achievements ───────────────────────────────────── */}
            <motion.section variants={staggerItem} aria-labelledby="milestones-heading">
              <SectionHeader
                title="Adherence Milestones"
                icon={<MedalIcon size={16} />}
                meta={`${unlockedCount} of ${achievements.length} earned`}
                className="mb-4"
              />
              <h2 id="milestones-heading" className="sr-only">
                Adherence Milestones
              </h2>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-xl)]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {achievements.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!a.unlocked}
                      onClick={() => a.unlocked && setSelectedMilestone(a)}
                      className={a.unlocked ? 'cursor-pointer text-left w-full' : 'text-left w-full cursor-default'}
                    >
                      <MilestoneBadgeCard achievement={a} />
                    </button>
                  ))}
                </div>
              )}
            </motion.section>
          </>
        )}

        {/* ── Emergency Quick Dial ─────────────────────────────────────────── */}
        <motion.section variants={staggerItem} aria-labelledby="emergency-heading">
          <Card accent="risk" className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-risk-bg text-risk-text border border-risk-border">
                  <EmergencyAmbulanceIcon size={20} />
                </span>
                <div>
                  <h2 id="emergency-heading" className="text-sm font-bold text-content">
                    Emergency Hotlines
                  </h2>
                  <p className="text-xs text-content-muted">Tap to call directly. Works offline.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {EMERGENCY_NUMBERS.map((line) => (
                  <a
                    key={line.tel}
                    href={`tel:${line.tel}`}
                    className="flex-1 sm:flex-initial min-w-20 px-3.5 py-2 rounded-xl border border-risk-border bg-risk-bg text-center hover:brightness-[0.96] transition-all"
                  >
                    <span className="block text-xs font-bold text-risk-text font-mono" data-numeric>
                      {line.tel}
                    </span>
                    <span className="block text-2xs text-content-muted">{line.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </Card>
        </motion.section>

        {/* Mobile action bar */}
        <div className="sm:hidden grid grid-cols-2 gap-2.5">
          <Link to="/prescriptions/new">
            <Button fullWidth leftIcon={<PrescriptionIcon size={16} />}>
              Prescription
            </Button>
          </Link>
          <Link to="/reports/new">
            <Button fullWidth variant="secondary" leftIcon={<LabFlaskIcon size={16} />}>
              Lab Report
            </Button>
          </Link>
        </div>
      </motion.div>

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
