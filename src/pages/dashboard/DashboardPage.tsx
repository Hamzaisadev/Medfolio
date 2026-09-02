import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Toast } from '../../components/ui/Toast';
import { QuickVitalsModal } from '../../components/vitals/QuickVitalsModal';
import { mealRelationIcon } from '../../components/ui/slotMeta';
import { VITAL_TONE } from '../../components/ui/vitalTone';
import {
  PrescriptionIcon,
  LabFlaskIcon,
  MedicineIcon,
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
  CalendarIcon,
  AlertCircleIcon,
  DoctorIcon,
  BarChartIcon,
} from '../../components/ui/icons';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  medicinesRepo,
  dosesRepo,
  testOrdersRepo,
  reportsRepo,
  visitsRepo,
} from '../../lib/db';
import { listResultsForReport, type ReportResult } from '../../lib/db/reports';
import { listGlucoseReadings, listBloodPressureReadings } from '../../lib/db/vitals';
import { decrementPill, readInventory } from '../../lib/inventory';
import { activeMedicines } from '../../domain/activeMedicines';
import { calculateAdherenceStreak, deriveStatusOnRead } from '../../domain/adherence';
import {
  evaluateGlucose,
  evaluateBloodPressure,
  calculateMap,
  type GlucoseReading,
  type BloodPressureReading,
} from '../../domain/vitals';
import { checkRedFlags } from '../../domain/redFlags';
import { mealRelationOf, mealRelationInstruction } from '../../domain/mealRelation';
import {
  todayInAppTz,
  addDaysAppTz,
  formatDoseTime,
  minutesInAppTz,
  formatDayHeading,
  formatDateShort,
} from '../../lib/time';
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

const QUICK_SYMPTOM_TAGS = [
  'Headache',
  'Chest Tightness',
  'Dizziness',
  'Fever',
  'Dry Cough',
  'Nausea',
  'Shortness of Breath',
  'Stomach Pain',
];

interface TimelineEventSummary {
  id: string;
  type: 'visit' | 'report' | 'medicine';
  title: string;
  subtitle: string;
  dateStr: string;
  link: string;
}

export function DashboardPage() {
  const { user, profile } = useAuth();
  const [activeMedsList, setActiveMedsList] = useState<Tables<'medicines'>[]>([]);
  const [medsMap, setMedsMap] = useState<Record<string, Tables<'medicines'>>>({});
  const [todayDoses, setTodayDoses] = useState<Tables<'doses'>[]>([]);
  const [streakDoses, setStreakDoses] = useState<Tables<'doses'>[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Tables<'test_orders'>[]>([]);
  const [recentReports, setRecentReports] = useState<Tables<'reports'>[]>([]);
  const [recentVisits, setRecentVisits] = useState<Tables<'visits'>[]>([]);
  const [labResults, setLabResults] = useState<ReportResult[]>([]);

  const [glucoseLogs, setGlucoseLogs] = useState<GlucoseReading[]>([]);
  const [bpLogs, setBpLogs] = useState<BloodPressureReading[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'risk' } | null>(null);

  // Interactive Quick Symptom Checker State
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);

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
      setRecentReports(reports);
      setRecentVisits(visits);
      setGlucoseLogs(glucose);
      setBpLogs(bp);

      // Load lab results for top recent reports to surface out-of-range biomarkers
      if (reports.length > 0) {
        try {
          const resultsNested = await Promise.all(
            reports.slice(0, 5).map((r) => listResultsForReport(r.id))
          );
          setLabResults(resultsNested.flat());
        } catch (rErr) {
          console.warn('Could not load detailed lab results:', rErr);
        }
      }
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

  const streakDays = calculateAdherenceStreak(streakDoses.map(toDoseRecord), new Date());
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

  // Estimated Monthly Healthcare Spend (in PKR / Rs.)
  const monthlySpendEstimate = useMemo(() => {
    try {
      const savedExpenses = localStorage.getItem(`medfolio_health_expenses_v1_${profileId}`);
      if (savedExpenses) {
        const parsed = JSON.parse(savedExpenses);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
        }
      }
    } catch {
      // fallback
    }
    // Baseline projection based on active medicines + recorded visits
    const medCost = activeMedsList.length * 950;
    const visitCost = recentVisits.reduce((sum, v) => sum + (v.visit_cost || 0), 0);
    return medCost + visitCost;
  }, [profileId, activeMedsList, recentVisits]);

  // Flagged out-of-range biomarkers from diagnostic lab reports
  const outOfRangeBiomarkers = useMemo(() => {
    return labResults.filter(
      (r) => r.range_status !== 'within' && r.range_status !== 'unknown'
    );
  }, [labResults]);

  // Live Symptom Triage Evaluation
  const symptomTriageResult = useMemo(() => {
    if (!selectedSymptom) return null;
    const redFlagCheck = checkRedFlags(selectedSymptom);
    return {
      name: selectedSymptom,
      isEmergency: redFlagCheck.isEmergency,
      advice: redFlagCheck.isEmergency
        ? 'High clinical priority: Seek urgent medical attention or consultation immediately.'
        : 'Common clinical symptom: Monitor hydration and rest. Can be added to your doctor brief.',
    };
  }, [selectedSymptom]);

  // Unified Longitudinal Timeline Summary (Last 3 events)
  const recentTimelineEvents = useMemo(() => {
    const events: TimelineEventSummary[] = [];

    // 1. Doctor Visits
    for (const v of recentVisits) {
      events.push({
        id: `visit-${v.id}`,
        type: 'visit',
        title: v.doctor_name ? `Dr. ${v.doctor_name}` : 'Doctor Consultation',
        subtitle: [v.specialty, v.clinic_name].filter(Boolean).join(' · ') || 'Clinical visit',
        dateStr: v.visit_date,
        link: '/doctor/brief',
      });
    }

    // 2. Lab Reports
    for (const r of recentReports) {
      events.push({
        id: `report-${r.id}`,
        type: 'report',
        title: r.title || 'Diagnostic Lab Report',
        subtitle: r.lab_name ? `Lab: ${r.lab_name}` : 'Test results added',
        dateStr: r.report_date,
        link: '/reports',
      });
    }

    // 3. Active Medicines
    for (const m of activeMedsList.slice(0, 3)) {
      events.push({
        id: `med-${m.id}`,
        type: 'medicine',
        title: m.medicine_name,
        subtitle: [m.strength, m.frequency_raw].filter(Boolean).join(' · ') || 'Active prescription',
        dateStr: m.start_date || today,
        link: `/medicines/${m.id}`,
      });
    }

    // Sort descending by date
    return events
      .sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime())
      .slice(0, 3);
  }, [recentVisits, recentReports, activeMedsList, today]);

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
        {/* ── Top Greeting & Primary Actions ─────────────────────────────────── */}
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
                BENTO ROW 1: THE CORE COMMAND CENTER (8 + 4 COLS)
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="core-hub-heading">
              <h2 id="core-hub-heading" className="sr-only">
                Medication and Spend Command Center
              </h2>

              {isLoading ? (
                <Skeleton className="h-48 w-full rounded-[var(--radius-xl)]" />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  {/* Card 1: Next Scheduled Dose Hero (8 Columns) */}
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

                            {remainingToday > 0 && (
                              <span className="text-2xs px-2.5 py-1 rounded-lg bg-surface-sunken text-content-subtle font-medium border border-line">
                                {remainingToday} dose{remainingToday === 1 ? '' : 's'} remaining today
                              </span>
                            )}
                          </div>

                          {nextMedicine?.instructions && (
                            <p className="mt-2.5 text-xs text-content-muted bg-surface-sunken/80 border border-line rounded-lg px-3 py-2 leading-relaxed">
                              <span className="font-semibold text-content">Instructions: </span>
                              {nextMedicine.instructions}
                            </p>
                          )}
                        </div>

                        {/* Quick 1-Tap Take Action & Timetable Link */}
                        <div className="mt-5 pt-3 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <Link
                            to="/medicines"
                            className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1"
                          >
                            <span>Open Timetable</span>
                            <ArrowRightIcon size={13} />
                          </Link>
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
                      <Card className="p-6 bg-surface-raised border border-line shadow-card flex flex-col justify-between w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <span className="shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl bg-ok-bg text-ok-text border border-ok-border">
                            <CheckIcon size={24} className="stroke-[2.5]" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold text-content">
                              All scheduled doses completed!
                            </p>
                            <p className="mt-1 text-xs text-content-muted">
                              {activeMedsList.length > 0
                                ? 'Your upcoming schedule is clean. Next due doses will appear here automatically.'
                                : 'Scan or enter a prescription to generate your automated timetable.'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                          <Link
                            to="/medicines"
                            className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                          >
                            <span>View Full Timetable</span>
                            <ArrowRightIcon size={13} />
                          </Link>
                          {activeMedsList.length === 0 && (
                            <Link to="/prescriptions/new">
                              <Button size="sm" leftIcon={<PrescriptionIcon size={14} />}>
                                Scan Prescription
                              </Button>
                            </Link>
                          )}
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Card 2: Healthcare Finances & Pharmacy Budget (4 Columns) */}
                  <div className="lg:col-span-4 flex">
                    <Card className="p-5 sm:p-6 bg-surface-raised border border-line shadow-card flex flex-col justify-between w-full">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle">
                            Health Spend & Pharmacy
                          </span>
                          <Badge tone="info" size="sm">
                            PKR
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <span className="text-2xs text-content-muted block">Estimated Monthly Spend</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl sm:text-3xl font-black text-content font-mono">
                              Rs. {monthlySpendEstimate.toLocaleString()}
                            </span>
                            <span className="text-xs font-semibold text-content-subtle">/ month</span>
                          </div>
                        </div>

                        {/* Refill status badge */}
                        <div className="mt-3.5 p-2.5 rounded-xl bg-surface-sunken/80 border border-line flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-content block truncate">
                              {lowStockMedicines.length > 0
                                ? `${lowStockMedicines.length} medicine(s) low on stock`
                                : `${activeMedsList.length} active prescription(s)`}
                            </span>
                            <span className="text-2xs text-content-subtle">
                              {lowStockMedicines.length > 0
                                ? 'Refill required within 5 days'
                                : 'Supplies adequately stocked'}
                            </span>
                          </div>
                          {lowStockMedicines.length > 0 ? (
                            <Badge tone="warn" size="sm">
                              Refill Due
                            </Badge>
                          ) : (
                            <Badge tone="ok" size="sm">
                              Stocked
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                        <Link
                          to="/finances"
                          className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1"
                        >
                          <span>Manage Expenses</span>
                          <ArrowRightIcon size={13} />
                        </Link>
                        <Link to="/medicines/cabinet">
                          <Button size="sm" variant="secondary" leftIcon={<MedicineIcon size={14} />}>
                            Reorder Refill
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 2: BIOMETRICS & CHRONIC VITALS BENTO (6 + 6 COLS)
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
                BENTO ROW 3: BIOMARKER RADAR & SYMPTOM TRIAGE (7 + 5 COLS)
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="biomarkers-symptoms-heading">
              <h2 id="biomarkers-symptoms-heading" className="sr-only">
                Biomarkers Radar and Symptom Checker
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 1. Biomarker Radar & Lab Trajectory (7 Columns) */}
                <Card className="lg:col-span-7 p-5 bg-surface-raised border border-line shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 flex items-center justify-center">
                          <BarChartIcon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-content">Biomarker Radar & Labs</h3>
                          <p className="text-2xs text-content-subtle">
                            Diagnostic test results & flagged markers
                          </p>
                        </div>
                      </div>

                      {pendingOrders.length > 0 ? (
                        <Badge tone="warn" size="sm">
                          {pendingOrders.length} Order(s) Due
                        </Badge>
                      ) : (
                        <Badge tone="ok" size="sm">
                          {recentReports.length} Reports
                        </Badge>
                      )}
                    </div>

                    {/* Out of range flagged lab results */}
                    {outOfRangeBiomarkers.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle">
                          Attention: Flagged Lab Values
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {outOfRangeBiomarkers.slice(0, 4).map((res) => (
                            <div
                              key={res.id}
                              className="p-2.5 rounded-xl bg-warn-bg/30 border border-warn-border/60 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-content block truncate">
                                  {res.test_name}
                                </span>
                                <span className="text-2xs text-content-subtle">
                                  Ref: {res.reference_range || 'N/A'}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-black text-warn-text font-mono block">
                                  {res.value_text} {res.unit || ''}
                                </span>
                                <Badge tone="warn" size="sm">
                                  {res.range_status === 'above' ? 'High' : 'Low'}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : pendingOrders.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-2xs uppercase tracking-wider font-bold text-content-subtle">
                          Pending Diagnostic Orders
                        </span>
                        {pendingOrders.slice(0, 2).map((order) => (
                          <div
                            key={order.id}
                            className="p-2.5 rounded-xl bg-surface-sunken/80 border border-line flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-content truncate">{order.test_name}</p>
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
                      <div className="py-4 text-center rounded-xl bg-surface-sunken/40 border border-line/60">
                        <p className="text-xs font-semibold text-content-muted">
                          All recorded biomarkers within expected targets
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">
                          Upload new lab reports to track longitudinal trajectories
                        </p>
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
                      <span>View All Reports</span>
                      <ArrowRightIcon size={12} />
                    </Link>
                  </div>
                </Card>

                {/* 2. Interactive Symptom Checker & Triage (5 Columns) */}
                <Card className="lg:col-span-5 p-5 bg-surface-raised border border-line shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center">
                          <ActivityIcon size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-content">Quick Symptom Check</h3>
                          <p className="text-2xs text-content-subtle">1-tap safety triage</p>
                        </div>
                      </div>
                      <Link to="/symptoms" className="text-2xs font-bold text-accent hover:underline">
                        Full Triage &rarr;
                      </Link>
                    </div>

                    <p className="text-2xs text-content-muted mb-2.5">
                      Select any active symptom for immediate red-flag safety grading:
                    </p>

                    {/* 1-Tap Symptom Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SYMPTOM_TAGS.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() =>
                            setSelectedSymptom(selectedSymptom === sym ? null : sym)
                          }
                          className={`px-2.5 py-1 rounded-xl text-2xs font-bold border transition-all cursor-pointer ${
                            selectedSymptom === sym
                              ? 'bg-accent text-content-onaccent border-accent shadow-2xs'
                              : 'bg-surface-sunken text-content-muted border-line hover:border-line-strong'
                          }`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>

                    {/* Live Triage Assessment Preview */}
                    {symptomTriageResult ? (
                      <div
                        className={`mt-3 p-2.5 rounded-xl border text-xs ${
                          symptomTriageResult.isEmergency
                            ? 'bg-risk-bg text-risk-text border-risk-border'
                            : 'bg-info-bg text-info-text border-info-border'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          {symptomTriageResult.isEmergency ? (
                            <>
                              <AlertCircleIcon size={14} /> Red-Flag Warning
                            </>
                          ) : (
                            <>
                              <CheckIcon size={14} /> Triage Assessment
                            </>
                          )}
                        </div>
                        <p className="text-2xs leading-relaxed">{symptomTriageResult.advice}</p>
                      </div>
                    ) : (
                      <div className="mt-3 p-2.5 rounded-xl bg-surface-sunken/40 border border-line text-2xs text-content-subtle">
                        Tap a symptom tag above to run instantaneous clinical safety analysis.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <Link
                      to="/symptoms"
                      className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1"
                    >
                      <span>Log Detailed Symptom Timeline</span>
                      <ArrowRightIcon size={12} />
                    </Link>
                  </div>
                </Card>
              </div>
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 4: LONGITUDINAL TIMELINE & CLINICAL DOSSIER (7 + 5 COLS)
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="timeline-dossier-heading">
              <h2 id="timeline-dossier-heading" className="sr-only">
                Longitudinal Timeline and Clinical Dossier
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 1. Longitudinal Medical Timeline Feed (7 Columns) */}
                <Card className="lg:col-span-7 p-5 bg-surface-raised border border-line shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-surface-sunken text-content border border-line flex items-center justify-center">
                          <CalendarIcon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-content">Longitudinal Health Timeline</h3>
                          <p className="text-2xs text-content-subtle">
                            Recent consultations, prescriptions & lab records
                          </p>
                        </div>
                      </div>

                      <Link to="/timeline" className="text-xs font-bold text-accent hover:underline flex items-center gap-1">
                        Full Stream <ArrowRightIcon size={12} />
                      </Link>
                    </div>

                    {/* Chronological Event Stream */}
                    {recentTimelineEvents.length > 0 ? (
                      <div className="space-y-2.5">
                        {recentTimelineEvents.map((ev) => (
                          <Link
                            key={ev.id}
                            to={ev.link}
                            className="group flex items-center justify-between gap-3 p-2.5 rounded-xl bg-surface-sunken/60 hover:bg-surface-sunken border border-line transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-7 h-7 rounded-lg bg-surface border border-line text-content flex items-center justify-center shrink-0">
                                {ev.type === 'visit' ? (
                                  <DoctorIcon size={14} />
                                ) : ev.type === 'report' ? (
                                  <LabFlaskIcon size={14} />
                                ) : (
                                  <MedicineIcon size={14} />
                                )}
                              </span>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-content block truncate group-hover:text-accent transition-colors">
                                  {ev.title}
                                </span>
                                <span className="text-2xs text-content-subtle truncate block">
                                  {ev.subtitle}
                                </span>
                              </div>
                            </div>

                            <span className="text-2xs font-mono font-medium text-content-muted shrink-0">
                              {formatDateShort(ev.dateStr)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-5 text-center rounded-xl bg-surface-sunken/40 border border-line/60">
                        <p className="text-xs font-semibold text-content-muted">
                          No clinical events recorded yet
                        </p>
                        <p className="text-2xs text-content-subtle mt-0.5">
                          Doctor visits and prescriptions will populate this longitudinal feed
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-2xs text-content-subtle">
                      Continuity of care across all treatments
                    </span>
                    <Link
                      to="/timeline"
                      className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1"
                    >
                      <span>Explore Timeline</span>
                      <ArrowRightIcon size={13} />
                    </Link>
                  </div>
                </Card>

                {/* 2. Clinical Care Dossier & Assistant Launchpad (5 Columns) */}
                <Card className="lg:col-span-5 p-5 bg-gradient-to-br from-surface-raised to-accent-subtle/20 border border-line shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 pb-2.5 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-accent text-content-onaccent flex items-center justify-center shadow-xs">
                          <SparklesIcon size={16} />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-content">Clinical Care Dossier</h3>
                          <p className="text-2xs text-content-muted">Consultation & guidance tools</p>
                        </div>
                      </div>
                      <Badge tone="info" size="sm">
                        24/7
                      </Badge>
                    </div>

                    <div className="space-y-2 mt-3">
                      <Link
                        to="/doctor/questions"
                        className="p-2.5 rounded-xl bg-surface border border-line hover:border-accent flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <QuestionIcon size={15} className="text-accent shrink-0" />
                          <span className="text-xs font-bold text-content truncate group-hover:text-accent">
                            Doctor Consultation Questions
                          </span>
                        </div>
                        <ArrowRightIcon size={13} className="text-content-subtle group-hover:translate-x-0.5 transition-transform" />
                      </Link>

                      <Link
                        to="/doctor/second-opinion"
                        className="p-2.5 rounded-xl bg-surface border border-line hover:border-accent flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileTextIcon size={15} className="text-indigo-500 shrink-0" />
                          <span className="text-xs font-bold text-content truncate group-hover:text-accent">
                            Second Opinion Export Pack
                          </span>
                        </div>
                        <ArrowRightIcon size={13} className="text-content-subtle group-hover:translate-x-0.5 transition-transform" />
                      </Link>

                      <Link
                        to="/assistant"
                        className="p-2.5 rounded-xl bg-surface border border-line hover:border-accent flex items-center justify-between transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MedicineIcon size={15} className="text-teal-600 shrink-0" />
                          <span className="text-xs font-bold text-content truncate group-hover:text-accent">
                            Drug Interaction Radar
                          </span>
                        </div>
                        <ArrowRightIcon size={13} className="text-content-subtle group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <span className="text-2xs text-content-subtle">
                      Encrypted & patient-controlled
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
              </div>
            </motion.section>

            {/* ═════════════════════════════════════════════════════════════════════
                BENTO ROW 5: EMERGENCY QUICK DIAL STRIP (12 COLS)
                ═════════════════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="emergency-heading">
              <Card accent="risk" className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-risk-bg text-risk-text border border-risk-border">
                      <EmergencyAmbulanceIcon size={20} />
                    </span>
                    <div>
                      <h2 id="emergency-heading" className="text-sm font-bold text-content">
                        Emergency Hotlines (Pakistan)
                      </h2>
                      <p className="text-xs text-content-muted">Tap to call directly. Works offline without internet.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {EMERGENCY_NUMBERS.map((line) => (
                      <a
                        key={line.tel}
                        href={`tel:${line.tel}`}
                        className="flex-1 sm:flex-initial min-w-24 px-3.5 py-2 rounded-xl border border-risk-border bg-risk-bg text-center hover:brightness-[0.96] transition-all"
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
    </AppShell>
  );
}
