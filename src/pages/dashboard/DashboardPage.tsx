import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { Toast } from '../../components/ui/Toast';
import { QuickVitalsModal } from '../../components/vitals/QuickVitalsModal';
import { MilestoneBadgeCard } from '../../components/ui/MilestoneBadgeCard';
import { evaluateAchievements } from '../../domain/achievements';
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
  TrophyIcon,
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

function isPrnMedicine(medicine: Tables<'medicines'> | undefined): boolean {
  return medicine?.frequency_code === 'PRN' || medicine?.frequency_code === 'SOS';
}

function formatReadingTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const EMERGENCY_NUMBERS = [
  { tel: '1122', label: 'Rescue' },
  { tel: '115', label: 'Edhi' },
  { tel: '1020', label: 'Chhipa' },
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

// ─── Inline mini bar chart (reference-style) ─────────────────────────────────
function MiniBars({ bars, color }: { bars: number[]; color: string }) {
  const max = Math.max(...bars, 1);
  return (
    <div className="flex items-end gap-0.5 h-8" aria-hidden>
      {bars.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{
            height: `${Math.max(15, (v / max) * 100)}%`,
            background:
              i === bars.length - 1
                ? color
                : 'var(--color-surface-hover)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Dot-matrix progress (reference-style "activity dots") ───────────────────
function ActivityDots({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: i < filled ? color : 'var(--color-surface-hover)' }}
        />
      ))}
    </div>
  );
}

// ─── Gradient icon badge (reference style) ───────────────────────────────────
function GradientBadge({
  children,
  gradient,
}: {
  children: React.ReactNode;
  gradient: string;
}) {
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-white shadow-sm"
      style={{ background: gradient }}
      aria-hidden
    >
      {children}
    </div>
  );
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
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [quickVitalsModal, setQuickVitalsModal] = useState<{
    open: boolean;
    type: 'glucose' | 'bp';
  }>({ open: false, type: 'glucose' });

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

      if (reports.length > 0) {
        try {
          const resultsNested = await Promise.all(
            reports.slice(0, 5).map((r) => listResultsForReport(r.id))
          );
          setLabResults(resultsNested.flat());
        } catch (rErr) {
          console.warn('Could not load lab results:', rErr);
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
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
      const s = deriveStatusOnRead(d, new Date());
      return s === 'pending' || s === 'missed';
    })
    .sort((a, b) => a.scheduled_minutes - b.scheduled_minutes);
  const nextDose = outstanding.find((d) => d.scheduled_minutes >= nowMinutes) ?? outstanding[0];
  const nextMedicine = nextDose ? medsMap[nextDose.medicine_id] : undefined;
  const remainingToday = outstanding.length;

  const latestGlucose = glucoseLogs[0];
  const latestBp = bpLogs[0];

  const glucoseEval = useMemo(
    () => (latestGlucose ? evaluateGlucose(latestGlucose.value_mg_dl, latestGlucose.type) : null),
    [latestGlucose]
  );
  const bpEval = useMemo(
    () => (latestBp ? evaluateBloodPressure(latestBp.systolic, latestBp.diastolic) : null),
    [latestBp]
  );
  const bpMapValue = useMemo(
    () => (latestBp ? calculateMap(latestBp.systolic, latestBp.diastolic) : null),
    [latestBp]
  );

  const lowStockMedicines = useMemo(() => {
    if (!profileId) return [];
    const inventory = readInventory(profileId);
    return activeMedsList.filter((m) => {
      const count = inventory[m.id];
      return typeof count === 'number' && count <= 5;
    });
  }, [activeMedsList, profileId]);

  const monthlySpendEstimate = useMemo(() => {
    try {
      const saved = localStorage.getItem(`medfolio_health_expenses_v1_${profileId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.reduce((s: number, i: { amount?: number }) => s + (Number(i.amount) || 0), 0);
        }
      }
    } catch { /* noop */ }
    return activeMedsList.length * 950 + recentVisits.reduce((s, v) => s + (v.visit_cost || 0), 0);
  }, [profileId, activeMedsList, recentVisits]);

  const outOfRangeBiomarkers = useMemo(
    () => labResults.filter((r) => r.range_status === 'above' || r.range_status === 'below'),
    [labResults]
  );

  const symptomTriageResult = useMemo(() => {
    if (!selectedSymptom) return null;
    const result = checkRedFlags(selectedSymptom);
    return {
      name: selectedSymptom,
      isEmergency: result.isEmergency,
      advice: result.isEmergency
        ? 'High clinical priority: Seek urgent medical attention immediately.'
        : 'Common symptom: Monitor closely. You can add this to your doctor brief.',
    };
  }, [selectedSymptom]);

  const recentTimelineEvents = useMemo(() => {
    const events: TimelineEventSummary[] = [];
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
    for (const m of activeMedsList.slice(0, 2)) {
      events.push({
        id: `med-${m.id}`,
        type: 'medicine',
        title: m.medicine_name,
        subtitle: [m.strength, m.frequency_raw].filter(Boolean).join(' · ') || 'Active prescription',
        dateStr: m.start_date || today,
        link: `/medicines/${m.id}`,
      });
    }
    return events
      .sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime())
      .slice(0, 3);
  }, [recentVisits, recentReports, activeMedsList, today]);

  // Achievements
  const achievements = useMemo(() => {
    const inRangeGlucose = glucoseLogs.filter((g) => {
      const ev = evaluateGlucose(g.value_mg_dl, g.type);
      return ev.tone === 'ok';
    }).length;
    const normalBp = bpLogs.filter((bp) => {
      const ev = evaluateBloodPressure(bp.systolic, bp.diastolic);
      return ev.tone === 'ok';
    }).length;
    return evaluateAchievements({
      adherenceStreakDays: streakDays,
      totalPrescriptions: activeMedsList.length,
      totalReports: recentReports.length,
      totalVisits: recentVisits.length,
      glucoseLogsCount: glucoseLogs.length,
      inRangeGlucoseCount: inRangeGlucose,
      bpLogsCount: bpLogs.length,
      normalBpCount: normalBp,
    });
  }, [streakDays, activeMedsList, recentReports, recentVisits, glucoseLogs, bpLogs]);

  // Fake last-7-days bar data for mini charts (derived from log counts per day)
  const glucoseBars = useMemo(() => {
    const buckets: number[] = [10, 10, 10, 10, 10, 10, 10];
    for (const g of glucoseLogs) {
      const daysAgo = Math.floor((Date.now() - new Date(g.measured_at).getTime()) / 86400000);
      const idx = 6 - daysAgo;
      if (daysAgo >= 0 && daysAgo < 7 && idx >= 0 && idx < 7) {
        buckets[idx] = (buckets[idx] ?? 10) + 40;
      }
    }
    return buckets;
  }, [glucoseLogs]);

  const bpBars = useMemo(() => {
    const buckets: number[] = [10, 10, 10, 10, 10, 10, 10];
    for (const b of bpLogs) {
      const daysAgo = Math.floor((Date.now() - new Date(b.measured_at).getTime()) / 86400000);
      const idx = 6 - daysAgo;
      if (daysAgo >= 0 && daysAgo < 7 && idx >= 0 && idx < 7) {
        buckets[idx] = (buckets[idx] ?? 10) + 40;
      }
    }
    return buckets;
  }, [bpLogs]);

  const currentHour = new Date().getHours();
  const timeGreeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppShell>
      <Toast
        open={Boolean(toast)}
        message={toast?.message || ''}
        tone={toast?.tone || 'ok'}
        onClose={() => setToast(null)}
      />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-5">

        {/* ── Greeting Header ──────────────────────────────────────────────── */}
        <motion.div
          variants={staggerItem}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-content tracking-tight">
                {timeGreeting}, {firstName}
              </h1>
              {streakDays > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                  <FlameIcon size={12} />
                  {streakDays}d
                </span>
              )}
            </div>
            <p className="text-sm text-content-muted mt-0.5">{formatDayHeading(today)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/prescriptions/new">
              <Button leftIcon={<PrescriptionIcon size={15} />} size="sm">
                Add Prescription
              </Button>
            </Link>
            <Link to="/assistant">
              <Button variant="secondary" leftIcon={<SparklesIcon size={15} />} size="sm">
                Assistant
              </Button>
            </Link>
          </div>
        </motion.div>

        {loadError ? (
          <ErrorState title="Dashboard didn't load" message={loadError} onRetry={loadDashboard} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Skeleton className="lg:col-span-8 h-48 rounded-2xl" />
            <Skeleton className="lg:col-span-4 h-48 rounded-2xl" />
            <Skeleton className="lg:col-span-6 h-44 rounded-2xl" />
            <Skeleton className="lg:col-span-6 h-44 rounded-2xl" />
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════
                ROW 1 — MEDICATION HERO (8) + HEALTH SPEND (4)
                ══════════════════════════════════════════════════════════ */}
            <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── Next Dose Hero Card (8 cols) ────────────────────── */}
              <div className="lg:col-span-8">
                {nextDose ? (
                  <Card className="p-6 h-full flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <GradientBadge gradient="linear-gradient(135deg,#6366f1,#8b5cf6)">
                          <MedicineIcon size={20} />
                        </GradientBadge>
                        <div>
                          <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                            Next Scheduled Dose
                          </p>
                          <h2 className="text-2xl font-black text-content tracking-tight leading-tight">
                            {nextMedicine?.medicine_name || 'Prescribed medicine'}
                          </h2>
                          <p className="text-sm text-content-muted mt-0.5">
                            {[nextMedicine?.strength, nextMedicine?.dose_amount].filter(Boolean).join(' · ') || 'Take as prescribed'}
                          </p>
                        </div>
                      </div>

                      {/* Due-time pill */}
                      <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-black text-sm font-mono">
                        <ClockIcon size={14} />
                        {formatDoseTime(nextDose.scheduled_minutes)}
                      </div>
                    </div>

                    {/* Meal + remaining info */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-surface-sunken border border-line font-medium text-content-muted">
                        {mealRelationIcon(mealRelationOf(nextMedicine?.with_food), 13)}
                        {mealRelationInstruction(nextMedicine?.with_food)}
                      </span>
                      {remainingToday > 0 && (
                        <span className="text-xs px-3 py-1.5 rounded-xl bg-surface-sunken border border-line font-medium text-content-subtle">
                          {remainingToday} dose{remainingToday !== 1 ? 's' : ''} remaining today
                        </span>
                      )}
                    </div>

                    {nextMedicine?.instructions && (
                      <p className="mt-3 text-xs text-content-muted bg-surface-sunken border border-line rounded-xl px-3 py-2 leading-relaxed">
                        <span className="font-semibold text-content">Note: </span>
                        {nextMedicine.instructions}
                      </p>
                    )}

                    <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-line">
                      <Link
                        to="/medicines"
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                      >
                        Open Timetable <ArrowRightIcon size={13} />
                      </Link>
                      <Button
                        onClick={() => handleMarkTaken(nextDose)}
                        leftIcon={<CheckIcon size={15} className="stroke-[2.5]" />}
                        size="sm"
                      >
                        Take Dose Now
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-6 h-full flex flex-col justify-between">
                    <div className="flex items-start gap-4">
                      <GradientBadge gradient="linear-gradient(135deg,#22c55e,#16a34a)">
                        <CheckIcon size={20} />
                      </GradientBadge>
                      <div>
                        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                          Medication Schedule
                        </p>
                        <h2 className="text-xl font-black text-content">All doses complete!</h2>
                        <p className="text-sm text-content-muted mt-1">
                          {activeMedsList.length > 0
                            ? 'Next due doses will appear here automatically.'
                            : 'Scan a prescription to set up your timetable.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-line">
                      <Link to="/medicines" className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                        View Timetable <ArrowRightIcon size={13} />
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

              {/* ── Health Spend Card (4 cols) ───────────────────────── */}
              <div className="lg:col-span-4">
                <Card className="p-6 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-start gap-3 mb-4">
                      <GradientBadge gradient="linear-gradient(135deg,#f59e0b,#d97706)">
                        <ActivityIcon size={18} />
                      </GradientBadge>
                      <div>
                        <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                          Health Spend
                        </p>
                        <p className="text-2xs text-content-subtle">Estimated monthly</p>
                      </div>
                    </div>

                    <div className="mb-1">
                      <span className="text-3xl font-black text-content font-mono tracking-tight">
                        Rs. {monthlySpendEstimate.toLocaleString()}
                      </span>
                      <span className="text-xs text-content-muted ml-1.5">/ mo</span>
                    </div>

                    {/* Activity dots as pharmacy items indicator */}
                    <div className="mt-3">
                      <ActivityDots
                        filled={activeMedsList.length}
                        total={Math.max(activeMedsList.length, 8)}
                        color="#f59e0b"
                      />
                    </div>

                    <div className={`mt-3 px-3 py-2 rounded-xl border text-xs font-medium ${
                      lowStockMedicines.length > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400'
                        : 'bg-surface-sunken border-line text-content-muted'
                    }`}>
                      {lowStockMedicines.length > 0
                        ? `${lowStockMedicines.length} medicine(s) need refill`
                        : `${activeMedsList.length} active prescriptions`}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-line mt-4">
                    <Link to="/finances" className="text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      Manage Expenses <ArrowRightIcon size={12} />
                    </Link>
                    <Link to="/medicines/cabinet">
                      <Button size="sm" variant="secondary" leftIcon={<MedicineIcon size={13} />}>
                        Reorder
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>
            </motion.div>

            {/* ══════════════════════════════════════════════════════════
                ROW 2 — BLOOD GLUCOSE (6) + BLOOD PRESSURE (6)
                ══════════════════════════════════════════════════════════ */}
            <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* ── Blood Glucose Card ───────────────────────────────── */}
              <Card className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <GradientBadge gradient="linear-gradient(135deg,#8b5cf6,#7c3aed)">
                      <DropletIcon size={18} />
                    </GradientBadge>
                    <div>
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                        Blood Glucose
                      </p>
                      <p className="text-2xs text-content-subtle">
                        {latestGlucose
                          ? `Last: ${formatReadingTime(latestGlucose.measured_at)}`
                          : 'No readings yet'}
                      </p>
                    </div>
                  </div>
                  {glucoseEval && (
                    <Badge tone={VITAL_TONE[glucoseEval.tone].badge} size="sm">
                      {glucoseEval.label}
                    </Badge>
                  )}
                </div>

                {latestGlucose ? (
                  <>
                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span className="text-4xl font-black text-content font-mono tracking-tight">
                        {latestGlucose.value_mg_dl}
                      </span>
                      <span className="text-sm font-semibold text-content-muted">/mg/dL</span>
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-lg bg-surface-sunken border border-line text-content-muted font-medium capitalize">
                        {latestGlucose.type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-3 mb-2 text-xs text-content-subtle flex items-center justify-between">
                      <span>This week</span>
                      <span className="font-semibold text-content-muted">{glucoseLogs.length} readings</span>
                    </div>
                    <MiniBars bars={glucoseBars} color="#8b5cf6" />
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-sm font-semibold text-content-muted">No readings yet</p>
                    <p className="text-xs text-content-subtle mt-1">Track fasting & post-meal levels</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 mt-3 border-t border-line">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<PlusIcon size={13} />}
                    onClick={() => setQuickVitalsModal({ open: true, type: 'glucose' })}
                  >
                    Log Blood Sugar
                  </Button>
                  <Link to="/vitals" className="text-xs font-bold text-violet-500 hover:text-violet-600 flex items-center gap-1">
                    Full Trends <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </Card>

              {/* ── Blood Pressure Card ──────────────────────────────── */}
              <Card className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <GradientBadge gradient="linear-gradient(135deg,#ef4444,#dc2626)">
                      <HeartPulseIcon size={18} />
                    </GradientBadge>
                    <div>
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                        Blood Pressure
                      </p>
                      <p className="text-2xs text-content-subtle">
                        {latestBp
                          ? `Last: ${formatReadingTime(latestBp.measured_at)}`
                          : 'No readings yet'}
                      </p>
                    </div>
                  </div>
                  {bpEval && (
                    <Badge tone={VITAL_TONE[bpEval.tone].badge} size="sm">
                      {bpEval.label}
                    </Badge>
                  )}
                </div>

                {latestBp ? (
                  <>
                    <div className="flex items-baseline gap-1.5 mb-1 flex-wrap">
                      <span className="text-4xl font-black text-content font-mono tracking-tight">
                        {latestBp.systolic}/{latestBp.diastolic}
                      </span>
                      <span className="text-sm font-semibold text-content-muted">mmHg</span>
                      {latestBp.pulse_bpm && (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-bold font-mono dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 flex items-center gap-1">
                          <HeartPulseIcon size={11} />
                          {latestBp.pulse_bpm} bpm
                        </span>
                      )}
                    </div>
                    {bpMapValue && (
                      <p className="text-xs text-content-subtle mb-1">MAP: {bpMapValue} mmHg</p>
                    )}
                    <div className="mt-3 mb-2 text-xs text-content-subtle flex items-center justify-between">
                      <span>This week</span>
                      <span className="font-semibold text-content-muted">{bpLogs.length} readings</span>
                    </div>
                    <MiniBars bars={bpBars} color="#ef4444" />
                  </>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-sm font-semibold text-content-muted">No readings yet</p>
                    <p className="text-xs text-content-subtle mt-1">Track systolic, diastolic & pulse</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 mt-3 border-t border-line">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<PlusIcon size={13} />}
                    onClick={() => setQuickVitalsModal({ open: true, type: 'bp' })}
                  >
                    Log Blood Pressure
                  </Button>
                  <Link to="/vitals" className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
                    Full Trends <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </Card>
            </motion.div>

            {/* ══════════════════════════════════════════════════════════
                ROW 3 — BIOMARKER RADAR (7) + SYMPTOM CHECKER (5)
                ══════════════════════════════════════════════════════════ */}
            <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── Biomarker Radar (7 cols) ─────────────────────────── */}
              <Card className="lg:col-span-7 p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <GradientBadge gradient="linear-gradient(135deg,#14b8a6,#0d9488)">
                      <BarChartIcon size={18} />
                    </GradientBadge>
                    <div>
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                        Biomarker Radar & Labs
                      </p>
                      <p className="text-2xs text-content-subtle">Flagged results & pending orders</p>
                    </div>
                  </div>
                  {pendingOrders.length > 0 ? (
                    <Badge tone="warn" size="sm">{pendingOrders.length} Due</Badge>
                  ) : (
                    <Badge tone="ok" size="sm">{recentReports.length} Reports</Badge>
                  )}
                </div>

                {outOfRangeBiomarkers.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-2xs font-bold uppercase tracking-wider text-content-subtle mb-2">
                      Flagged Lab Values
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {outOfRangeBiomarkers.slice(0, 4).map((res) => (
                        <div
                          key={res.id}
                          className="p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-content truncate">{res.test_name}</p>
                            <p className="text-2xs text-content-subtle">Ref: {res.reference_range || 'N/A'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">
                              {res.value_text} {res.unit || ''}
                            </p>
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
                    <p className="text-2xs font-bold uppercase tracking-wider text-content-subtle mb-2">
                      Pending Orders
                    </p>
                    {pendingOrders.slice(0, 2).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-sunken border border-line">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-content truncate">{o.test_name}</p>
                          <p className="text-2xs text-content-subtle">{o.notes || o.ordered_date}</p>
                        </div>
                        <Badge tone="warn" size="sm">Pending</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-5 text-center rounded-xl bg-surface-sunken border border-dashed border-line">
                    <p className="text-sm font-semibold text-content-muted">All biomarkers on target</p>
                    <p className="text-xs text-content-subtle mt-0.5">Upload lab reports to track trends</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-line">
                  <Link to="/reports/new">
                    <Button size="sm" variant="secondary" leftIcon={<PlusIcon size={13} />}>
                      Upload Lab Report
                    </Button>
                  </Link>
                  <Link to="/reports" className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1">
                    All Reports <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </Card>

              {/* ── Quick Symptom Checker (5 cols) ───────────────────── */}
              <Card className="lg:col-span-5 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <GradientBadge gradient="linear-gradient(135deg,#6366f1,#4f46e5)">
                    <ActivityIcon size={18} />
                  </GradientBadge>
                  <div>
                    <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                      Symptom Checker
                    </p>
                    <p className="text-2xs text-content-subtle">1-tap red-flag triage</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_SYMPTOM_TAGS.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setSelectedSymptom(selectedSymptom === sym ? null : sym)}
                      className={`px-2.5 py-1 rounded-xl text-2xs font-bold border transition-all cursor-pointer ${
                        selectedSymptom === sym
                          ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                          : 'bg-surface-sunken text-content-muted border-line hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>

                {symptomTriageResult ? (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      symptomTriageResult.isEmergency
                        ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <AlertCircleIcon size={13} />
                      {symptomTriageResult.isEmergency ? 'Red-Flag Warning' : 'Clinical Guidance'}
                    </div>
                    <p className="text-2xs leading-relaxed">{symptomTriageResult.advice}</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-surface-sunken border border-dashed border-line text-2xs text-content-subtle text-center">
                    Select a symptom for instant safety grading
                  </div>
                )}

                <div className="flex items-center justify-end pt-4 mt-3 border-t border-line">
                  <Link to="/symptoms" className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                    Full Symptom Log <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </Card>
            </motion.div>

            {/* ══════════════════════════════════════════════════════════
                ROW 4 — TIMELINE (7) + CLINICAL DOSSIER (5)
                ══════════════════════════════════════════════════════════ */}
            <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── Health Timeline (7 cols) ─────────────────────────── */}
              <Card className="lg:col-span-7 p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3">
                    <GradientBadge gradient="linear-gradient(135deg,#64748b,#475569)">
                      <CalendarIcon size={18} />
                    </GradientBadge>
                    <div>
                      <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                        Health Timeline
                      </p>
                      <p className="text-2xs text-content-subtle">Recent clinical events</p>
                    </div>
                  </div>
                  <Link to="/timeline" className="text-xs font-bold text-content-muted hover:text-accent flex items-center gap-1">
                    Full Stream <ArrowRightIcon size={12} />
                  </Link>
                </div>

                {recentTimelineEvents.length > 0 ? (
                  <div className="space-y-2">
                    {recentTimelineEvents.map((ev) => (
                      <Link
                        key={ev.id}
                        to={ev.link}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line transition-all"
                      >
                        <div className="w-8 h-8 rounded-xl bg-surface border border-line flex items-center justify-center shrink-0 text-content-muted">
                          {ev.type === 'visit' ? <DoctorIcon size={15} /> : ev.type === 'report' ? <LabFlaskIcon size={15} /> : <MedicineIcon size={15} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-content truncate group-hover:text-accent transition-colors">
                            {ev.title}
                          </p>
                          <p className="text-2xs text-content-subtle truncate">{ev.subtitle}</p>
                        </div>
                        <span className="text-2xs font-mono text-content-subtle shrink-0">
                          {formatDateShort(ev.dateStr)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-5 text-center rounded-xl bg-surface-sunken border border-dashed border-line">
                    <p className="text-sm font-semibold text-content-muted">No events yet</p>
                    <p className="text-xs text-content-subtle mt-0.5">Visits and reports will appear here</p>
                  </div>
                )}

                <div className="flex items-center justify-end pt-4 mt-4 border-t border-line">
                  <Link to="/timeline" className="text-xs font-bold text-slate-500 hover:text-slate-600 flex items-center gap-1">
                    Explore Timeline <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </Card>

              {/* ── Clinical Care Dossier (5 cols) ───────────────────── */}
              <Card className="lg:col-span-5 p-6">
                <div className="flex items-start gap-3 mb-5">
                  <GradientBadge gradient="linear-gradient(135deg,#06b6d4,#0891b2)">
                    <SparklesIcon size={18} />
                  </GradientBadge>
                  <div>
                    <p className="text-xs font-semibold text-content-muted uppercase tracking-wider mb-0.5">
                      Clinical Dossier
                    </p>
                    <p className="text-2xs text-content-subtle">24/7 consultation tools</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { to: '/doctor/questions', icon: <QuestionIcon size={15} />, label: 'Doctor Consultation Questions', color: 'text-cyan-600 dark:text-cyan-400' },
                    { to: '/doctor/second-opinion', icon: <FileTextIcon size={15} />, label: 'Second Opinion Export Pack', color: 'text-indigo-600 dark:text-indigo-400' },
                    { to: '/assistant', icon: <MedicineIcon size={15} />, label: 'Drug Interaction Radar', color: 'text-teal-600 dark:text-teal-400' },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line transition-all group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={item.color}>{item.icon}</span>
                        <span className="text-xs font-bold text-content truncate group-hover:text-accent transition-colors">
                          {item.label}
                        </span>
                      </div>
                      <ArrowRightIcon size={13} className="text-content-subtle shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>

                <div className="flex items-center justify-end pt-4 mt-4 border-t border-line">
                  <Link to="/assistant" className="text-xs font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                    Open Assistant <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </Card>
            </motion.div>

            {/* ══════════════════════════════════════════════════════════
                ROW 5 — ACHIEVEMENTS (FULL WIDTH)
                ══════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="achievements-heading">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <GradientBadge gradient="linear-gradient(135deg,#f59e0b,#b45309)">
                    <TrophyIcon size={16} />
                  </GradientBadge>
                  <div>
                    <h2
                      id="achievements-heading"
                      className="text-sm font-bold text-content"
                    >
                      Health Milestones & Achievements
                    </h2>
                    <p className="text-2xs text-content-subtle">
                      {achievements.filter((a) => a.unlocked).length} of {achievements.length} earned
                    </p>
                  </div>
                </div>
                {streakDays > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                    <FlameIcon size={12} />
                    {streakDays}-day streak
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {achievements.map((achievement) => (
                  <MilestoneBadgeCard key={achievement.id} achievement={achievement} />
                ))}
              </div>
            </motion.section>

            {/* ══════════════════════════════════════════════════════════
                ROW 6 — EMERGENCY QUICK DIAL STRIP (FULL WIDTH)
                ══════════════════════════════════════════════════════════ */}
            <motion.section variants={staggerItem} aria-labelledby="emergency-heading">
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <GradientBadge gradient="linear-gradient(135deg,#ef4444,#b91c1c)">
                      <EmergencyAmbulanceIcon size={18} />
                    </GradientBadge>
                    <div>
                      <h2 id="emergency-heading" className="text-sm font-bold text-content">
                        Emergency Hotlines
                      </h2>
                      <p className="text-2xs text-content-muted">Tap to call · Works offline</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {EMERGENCY_NUMBERS.map((line) => (
                      <a
                        key={line.tel}
                        href={`tel:${line.tel}`}
                        className="flex-1 sm:flex-initial min-w-20 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 transition-all text-center dark:bg-red-500/10 dark:border-red-500/20 dark:hover:bg-red-500/20"
                      >
                        <span className="block text-sm font-black text-red-700 dark:text-red-400 font-mono" data-numeric>
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
