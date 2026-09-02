import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ErrorState } from '../../components/ui/ErrorState';
import { MetricCard } from '../../components/ui/MetricCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { DoseCard } from '../../components/ui/DoseCard';
import { MilestoneBadgeCard } from '../../components/ui/MilestoneBadgeCard';
import { SLOT_META } from '../../components/ui/slotMeta';
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
} from '../../components/ui/icons';
import { useAuth } from '../../lib/auth/AuthContext';
import { medicinesRepo, dosesRepo, testOrdersRepo, reportsRepo, visitsRepo } from '../../lib/db';
import { listGlucoseReadings, listBloodPressureReadings } from '../../lib/db/vitals';
import { activeMedicines } from '../../domain/activeMedicines';
import { evaluateAchievements } from '../../domain/achievements';
import { calculateAdherence, calculateAdherenceStreak, deriveStatusOnRead } from '../../domain/adherence';
import { evaluateGlucose, evaluateBloodPressure } from '../../domain/vitals';
import { bucketOf } from '../../domain/timeBuckets';
import { todayInAppTz, addDaysAppTz, formatDoseTime, minutesInAppTz, formatDayHeading } from '../../lib/time';
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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const today = todayInAppTz();
  const userId = user?.id || profile?.user_id || '';
  const profileId = profile?.id || userId;

  const loadDashboard = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      // The streak needs history, so doses are fetched over a window rather
      // than for today alone.
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

      setVitalStats({
        glucoseLogs: glucose.length,
        inRangeGlucose: glucose.filter(
          (g) => evaluateGlucose(g.value_mg_dl, g.type).status === 'normal'
        ).length,
        bpLogs: bp.length,
        normalBp: bp.filter(
          (b) => evaluateBloodPressure(b.systolic, b.diastolic).stage === 'normal'
        ).length,
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      // A failed load must never fall through to the empty state — "No medicines
      // scheduled" would be a lie when the database call simply did not run.
      setLoadError('Your dashboard could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [profileId, today]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

  // The next dose that still needs action, so the hero always shows the single
  // thing the patient should do next rather than a wall of numbers.
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
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-content tracking-tight">
              {timeGreeting}, {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-content-muted">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-hover text-content-muted font-medium border border-line">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Pakistan Standard Time
            </span>
            <span>•</span>
            <span>{formatDayHeading(today)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/prescriptions/new">
            <Button leftIcon={<PrescriptionIcon size={17} />} className="shadow-sm hover:shadow-md tap-spring">
              Add Prescription
            </Button>
          </Link>
          <Link to="/assistant">
            <Button variant="secondary" className="tap-spring" leftIcon={<SparklesIcon size={16} />}>
              Health Assistant
            </Button>
          </Link>
        </div>
      </div>

      {loadError ? (
        <ErrorState
          title="Dashboard didn't load"
          message={loadError}
          onRetry={loadDashboard}
          className="mb-8"
        />
      ) : (
        <>
          {/* ── Next dose hero ─────────────────────────────────────────────── */}
          <section className="mb-8" aria-labelledby="next-dose-heading">
            <h2 id="next-dose-heading" className="sr-only">
              Your next dose
            </h2>

            {isLoading ? (
              <Skeleton className="h-44 w-full rounded-[var(--radius-xl)]" />
            ) : nextDose ? (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-stretch">
                <DoseCard
                  medicineName={nextMedicine?.medicine_name || 'Prescribed medicine'}
                  strength={nextMedicine?.strength}
                  doseAmount={nextMedicine?.dose_amount}
                  scheduledMinutes={nextDose.scheduled_minutes}
                  status={deriveStatusOnRead(nextDose, new Date())}
                  withFood={nextMedicine?.with_food}
                  instructions={nextMedicine?.instructions}
                  readOnly
                />

                <Card className="lg:w-64 flex flex-col justify-center">
                  <div className="flex items-center gap-4">
                    <ProgressRing
                      percentage={hasScheduledToday ? adherence.percentage : 0}
                      size={64}
                      strokeWidth={6}
                      tone={adherence.percentage >= 80 ? 'ok' : 'warn'}
                    />
                    <div>
                      <p className="text-sm font-semibold text-content">
                        {takenToday} of {takenToday + remainingToday} taken
                      </p>
                      <p className="mt-0.5 text-xs text-content-muted">
                        {remainingToday} still to go today
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/medicines"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:underline"
                  >
                    Open today’s schedule
                    <ArrowRightIcon size={14} />
                  </Link>
                </Card>
              </div>
            ) : (
              <Card accent={hasScheduledToday ? 'ok' : 'none'}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <span className="shrink-0 flex items-center justify-center w-12 h-12 rounded-[var(--radius-lg)] bg-accent-subtle text-accent">
                    <MedicineIcon size={22} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-content">
                      {hasScheduledToday
                        ? 'All doses done for today'
                        : activeMedsList.length > 0
                          ? 'Nothing due right now'
                          : 'No medicines scheduled yet'}
                    </p>
                    <p className="mt-1 text-sm text-content-muted">
                      {hasScheduledToday
                        ? `You took all ${takenToday} of today’s doses. ${streakDays > 0 ? `That is ${streakDays} day${streakDays === 1 ? '' : 's'} in a row.` : ''}`
                        : activeMedsList.length > 0
                          ? 'Your next dose will appear here when it is due.'
                          : 'Scan a prescription and your dose schedule is built for you.'}
                    </p>
                  </div>
                  {activeMedsList.length === 0 && (
                    <Link to="/prescriptions/new" className="shrink-0">
                      <Button>Scan a prescription</Button>
                    </Link>
                  )}
                </div>
              </Card>
            )}
          </section>

          {/* ── At a glance ────────────────────────────────────────────────── */}
          <section className="mb-8" aria-labelledby="glance-heading">
            <SectionHeader
              title="At a glance"
              icon={<ClockIcon size={16} />}
              className="mb-4"
            />
            <h2 id="glance-heading" className="sr-only">
              At a glance
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Active medicines"
                value={isLoading ? '—' : activeMedsList.length}
                detail="Courses running today"
                icon={<MedicineIcon size={17} />}
                to="/medicines/cabinet"
              />
              <MetricCard
                label="Adherence streak"
                value={isLoading ? '—' : `${streakDays} ${streakDays === 1 ? 'day' : 'days'}`}
                detail={streakDays > 0 ? 'Consecutive full days' : 'Take every dose to start one'}
                tone={streakDays > 0 ? 'ok' : 'neutral'}
                icon={<MedalIcon size={17} />}
              />
              <MetricCard
                label="Pending labs"
                value={isLoading ? '—' : pendingOrders.length}
                detail={pendingOrders[0]?.test_name || 'Nothing waiting'}
                tone={pendingOrders.length > 0 ? 'warn' : 'neutral'}
                icon={<LabFlaskIcon size={17} />}
                to="/reports"
                trailing={
                  pendingOrders.length > 0 ? (
                    <Badge tone="warn" size="sm">
                      Due
                    </Badge>
                  ) : undefined
                }
              />
              <MetricCard
                label="Records saved"
                value={isLoading ? '—' : recordCounts.reports + recordCounts.visits}
                detail={`${recordCounts.visits} visits · ${recordCounts.reports} reports`}
                icon={<FileTextIcon size={17} />}
                to="/timeline"
              />
            </div>
          </section>

          {/* ── Rest of today ──────────────────────────────────────────────── */}
          {!isLoading && todayDoses.length > 0 && (
            <section className="mb-8" aria-labelledby="rest-of-day-heading">
              <SectionHeader
                title="Rest of today"
                meta={`${todayDoses.length} dose${todayDoses.length === 1 ? '' : 's'}`}
                icon={SLOT_META[bucketOf(nowMinutes)].icon(16)}
                tone={SLOT_META[bucketOf(nowMinutes)].tone}
                className="mb-4"
              />
              <h2 id="rest-of-day-heading" className="sr-only">
                Rest of today
              </h2>

              <ul className="divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-surface-raised overflow-hidden">
                {todayDoses
                  .slice()
                  .sort((a, b) => a.scheduled_minutes - b.scheduled_minutes)
                  .map((dose) => {
                    const med = medsMap[dose.medicine_id];
                    const status = deriveStatusOnRead(dose, new Date());
                    const slot = SLOT_META[bucketOf(dose.scheduled_minutes)];

                    return (
                      <li key={dose.id} className="flex items-center gap-3 px-4 py-3">
                        <span
                          className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] ${slot.surface} ${slot.text}`}
                        >
                          {slot.icon(16)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-content truncate">
                            {med?.medicine_name || 'Prescribed medicine'}
                            {med?.strength ? ` · ${med.strength}` : ''}
                          </p>
                          <p className="text-xs text-content-subtle" data-numeric>
                            {formatDoseTime(dose.scheduled_minutes)}
                          </p>
                        </div>
                        {status === 'taken' && (
                          <Badge tone="ok" size="sm" withIcon>
                            Taken
                          </Badge>
                        )}
                        {status === 'skipped' && (
                          <Badge tone="neutral" size="sm">
                            Skipped
                          </Badge>
                        )}
                        {status === 'missed' && (
                          <Badge tone="warn" size="sm" withIcon>
                            Overdue
                          </Badge>
                        )}
                        {status === 'pending' && (
                          <span className="text-xs font-medium text-content-subtle">Upcoming</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

          {/* ── Quick tools ────────────────────────────────────────────────── */}
          <section className="mb-8" aria-labelledby="tools-heading">
            <SectionHeader title="Quick tools" className="mb-4" />
            <h2 id="tools-heading" className="sr-only">
              Quick tools
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  to: '/vitals',
                  icon: <DropletIcon size={19} />,
                  title: 'Sugar & blood pressure',
                  detail: 'Log a reading',
                },
                {
                  to: '/doctor/questions',
                  icon: <QuestionIcon size={19} />,
                  title: 'Questions for your doctor',
                  detail: 'Prepare for your visit',
                },
                {
                  to: '/doctor/second-opinion',
                  icon: <FileTextIcon size={19} />,
                  title: 'Second opinion pack',
                  detail: 'Anonymised export',
                },
              ].map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  className="group flex items-center gap-3 p-4 rounded-[var(--radius-lg)] border border-line bg-surface-raised hover:border-line-strong hover:shadow-raise transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-accent-subtle text-accent">
                    {tool.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-content truncate">
                      {tool.title}
                    </span>
                    <span className="block text-xs text-content-subtle">{tool.detail}</span>
                  </span>
                  <ArrowRightIcon
                    size={16}
                    className="ml-auto shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          </section>

          {/* ── Milestones ─────────────────────────────────────────────────── */}
          <section className="mb-8" aria-labelledby="milestones-heading">
            <SectionHeader
              title="Milestones"
              icon={<MedalIcon size={16} />}
              meta={`${unlockedCount} of ${achievements.length} earned`}
              className="mb-4"
            />
            <h2 id="milestones-heading" className="sr-only">
              Milestones
            </h2>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-[var(--radius-lg)]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.map((a) => (
                  <MilestoneBadgeCard key={a.id} achievement={a} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Emergency: static and offline, so it stays visible even when the
          dashboard data failed to load. ─────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="emergency-heading">
        <Card accent="risk">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-risk-bg text-risk-text">
                <EmergencyAmbulanceIcon size={20} />
              </span>
              <div>
                <h2 id="emergency-heading" className="text-sm font-bold text-content">
                  Emergency numbers
                </h2>
                <p className="text-xs text-content-muted">Tap to call. Works offline.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {EMERGENCY_NUMBERS.map((line) => (
                <a
                  key={line.tel}
                  href={`tel:${line.tel}`}
                  className="flex-1 sm:flex-initial min-w-20 px-3.5 py-2.5 rounded-[var(--radius-md)] border border-risk-border bg-risk-bg text-center hover:brightness-[0.97] transition-[filter]"
                >
                  <span className="block text-sm font-bold text-risk-text" data-numeric>
                    {line.tel}
                  </span>
                  <span className="block text-2xs text-content-muted">{line.label}</span>
                </a>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* Mobile action bar: the header actions are hidden below sm. */}
      <div className="sm:hidden grid grid-cols-2 gap-2.5 mb-8">
        <Link to="/prescriptions/new">
          <Button fullWidth leftIcon={<PrescriptionIcon size={17} />}>
            Prescription
          </Button>
        </Link>
        <Link to="/reports/new">
          <Button fullWidth variant="secondary" leftIcon={<LabFlaskIcon size={17} />}>
            Lab report
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
