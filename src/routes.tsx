import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { PageHeader } from './components/layout/PageHeader';
import { Button } from './components/ui/Button';
import { IconButton } from './components/ui/IconButton';
import { Card } from './components/ui/Card';
import { Field } from './components/ui/Field';
import { Input } from './components/ui/Input';
import { Textarea } from './components/ui/Textarea';
import { Select } from './components/ui/Select';
import { Badge } from './components/ui/Badge';
import { Dialog } from './components/ui/Dialog';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { Sheet } from './components/ui/Sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/Tabs';
import { Skeleton } from './components/ui/Skeleton';
import { EmptyState } from './components/ui/EmptyState';
import { ErrorState } from './components/ui/ErrorState';
import { Toast } from './components/ui/Toast';
import { ProgressRing } from './components/ui/ProgressRing';
import { Disclaimer } from './components/ui/Disclaimer';
import {
  PrescriptionIcon,
  LabFlaskIcon,
} from './components/ui/icons';
import {
  EXTRACTION_DISCLAIMER,
  MEDICINE_INFO_DISCLAIMER,
  REPORT_OUT_OF_RANGE_NOTE,
} from './lib/disclaimer';

// Lazy-loaded route components for high performance & code splitting
const CapturePrescriptionPage = lazy(() =>
  import('./pages/prescriptions/CapturePrescriptionPage').then((m) => ({ default: m.CapturePrescriptionPage }))
);
const ReviewPrescriptionPage = lazy(() =>
  import('./pages/prescriptions/ReviewPrescriptionPage').then((m) => ({ default: m.ReviewPrescriptionPage }))
);
const TodaySchedulePage = lazy(() =>
  import('./pages/medicines/TodaySchedulePage').then((m) => ({ default: m.TodaySchedulePage }))
);
const MedicineCabinetPage = lazy(() =>
  import('./pages/medicines/MedicineCabinetPage').then((m) => ({ default: m.MedicineCabinetPage }))
);
const MedicineDetailPage = lazy(() =>
  import('./pages/medicines/MedicineDetailPage').then((m) => ({ default: m.MedicineDetailPage }))
);
const CaptureReportPage = lazy(() =>
  import('./pages/reports/CaptureReportPage').then((m) => ({ default: m.CaptureReportPage }))
);
const ReviewReportPage = lazy(() =>
  import('./pages/reports/ReviewReportPage').then((m) => ({ default: m.ReviewReportPage }))
);
const ReportsListPage = lazy(() =>
  import('./pages/reports/ReportsListPage').then((m) => ({ default: m.ReportsListPage }))
);
const TimelinePage = lazy(() =>
  import('./pages/timeline/TimelinePage').then((m) => ({ default: m.TimelinePage }))
);
const DoctorBriefPage = lazy(() =>
  import('./pages/doctor/DoctorBriefPage').then((m) => ({ default: m.DoctorBriefPage }))
);
const ShareManagementPage = lazy(() =>
  import('./pages/share/ShareManagementPage').then((m) => ({ default: m.ShareManagementPage }))
);
const PublicShareView = lazy(() =>
  import('./pages/share/PublicShareView').then((m) => ({ default: m.PublicShareView }))
);
const ShareVerifyPage = lazy(() =>
  import('./pages/share/ShareVerifyPage').then((m) => ({ default: m.ShareVerifyPage }))
);
const SymptomTriagePage = lazy(() =>
  import('./pages/symptoms/SymptomTriagePage').then((m) => ({ default: m.SymptomTriagePage }))
);
const SearchRecordsPage = lazy(() =>
  import('./pages/search/SearchRecordsPage').then((m) => ({ default: m.SearchRecordsPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

// Auth & Assistant Pages
const LoginPage = lazy(() =>
  import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignUpPage = lazy(() =>
  import('./pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const AssistantPage = lazy(() =>
  import('./pages/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage }))
);
const FinancePage = lazy(() =>
  import('./pages/finance/FinancePage').then((m) => ({ default: m.FinancePage }))
);
const DoctorDirectoryPage = lazy(() =>
  import('./pages/doctor/DoctorDirectoryPage').then((m) => ({ default: m.DoctorDirectoryPage }))
);
const VitalsTrackerPage = lazy(() =>
  import('./pages/vitals/VitalsTrackerPage').then((m) => ({ default: m.VitalsTrackerPage }))
);
const DoctorQuestionsPage = lazy(() =>
  import('./pages/doctor/DoctorQuestionsPage').then((m) => ({ default: m.DoctorQuestionsPage }))
);
const SecondOpinionPage = lazy(() =>
  import('./pages/doctor/SecondOpinionPage').then((m) => ({ default: m.SecondOpinionPage }))
);
const LandingPage = lazy(() =>
  import('./pages/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/error/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))
);

function RouteLoadingFallback() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto py-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </AppShell>
  );
}

import { Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth/AuthContext';
import { medicinesRepo, dosesRepo, testOrdersRepo } from './lib/db';
import { activeMedicines } from './domain/activeMedicines';
import { evaluateAchievements } from './domain/achievements';
import { MilestoneBadgeCard } from './components/ui/MilestoneBadgeCard';
import { todayInAppTz, formatDoseTime } from './lib/time';
import type { Tables } from './lib/supabase/types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function HomeRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (user) {
    return <DashboardScreen />;
  }

  return <LandingPage />;
}

function DashboardScreen() {
  const { user, profile } = useAuth();
  const [activeMedsList, setActiveMedsList] = useState<Tables<'medicines'>[]>([]);
  const [medsMap, setMedsMap] = useState<Record<string, Tables<'medicines'>>>({});
  const [todayDoses, setTodayDoses] = useState<Tables<'doses'>[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Tables<'test_orders'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = todayInAppTz();
  const userId = user?.id || profile?.user_id || '';
  const profileId = profile?.id || userId;

  useEffect(() => {
    async function loadDashboard() {
      if (!userId) return;
      setIsLoading(true);
      try {
        let [meds, doses, orders] = await Promise.all([
          medicinesRepo.listMedicines(profileId),
          dosesRepo.listDosesForDate(profileId, today),
          testOrdersRepo.listPendingTestOrders(profileId),
        ]);

        const map: Record<string, Tables<'medicines'>> = {};
        for (const m of meds) {
          map[m.id] = m;
        }
        setMedsMap(map);

        const activeList = activeMedicines(meds, today);
        setActiveMedsList(activeList);

        if (doses.length === 0 && activeList.length > 0) {
          doses = await dosesRepo.listDosesForDate(profileId, today);
        }

        setTodayDoses(doses);
        setPendingOrders(orders);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, [userId, profileId, today]);

  const takenDosesCount = todayDoses.filter((d) => d.status === 'taken').length;
  const adherencePercent = todayDoses.length > 0 ? Math.round((takenDosesCount / todayDoses.length) * 100) : 100;
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Patient';

  const dashboardAchievements = evaluateAchievements({
    adherenceStreakDays: adherencePercent === 100 ? 7 : Math.max(0, Math.floor(adherencePercent / 15)),
    totalPrescriptions: activeMedsList.length,
    totalReports: 0,
    totalVisits: 0,
    glucoseLogsCount: 0,
    inRangeGlucoseCount: 0,
    bpLogsCount: 0,
    normalBpCount: 0,
    activeDrugInteractionsCount: 0,
  });

  return (
    <AppShell>
      <PageHeader
        title={`Hello, ${firstName}`}
        description="Here is your health summary and today's schedule in Karachi (PKT)."
        action={
          <div className="flex items-center gap-2">
            <Link to="/prescriptions/new">
              <Button leftIcon={<PrescriptionIcon size={18} />}>Add Prescription</Button>
            </Link>
            <Link to="/reports/new">
              <Button variant="secondary" leftIcon={<LabFlaskIcon size={18} />}>Add Lab Report</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Adherence Card */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-ink-900">Today's Adherence</span>
              <Badge tone={adherencePercent >= 80 ? 'ok' : 'warn'}>
                {adherencePercent >= 80 ? 'On Track' : 'Needs Attention'}
              </Badge>
            </div>
          }
        >
          <div className="flex items-center gap-4 py-1">
            <ProgressRing
              percentage={adherencePercent}
              size={56}
              strokeWidth={5}
            />
            <div>
              <p className="text-xs font-medium text-ink-600">
                {takenDosesCount} of {todayDoses.length} doses taken
              </p>
              <p className="text-[11px] text-ink-500 mt-0.5">Keep it up to reach 100%!</p>
            </div>
          </div>
        </Card>

        {/* Active Medicines Card */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-ink-900">Active Regimen</span>
              <Link to="/medicines" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
                View All &rarr;
              </Link>
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div>
              <p className="text-2xl font-black text-ink-900 tracking-tight">{activeMedsList.length}</p>
              <p className="text-xs font-medium text-ink-500 mt-1">Prescribed courses active today</p>
            </div>
          )}
        </Card>

        {/* Emergency Card */}
        <Card header={<span className="font-semibold text-sm text-ink-900">Emergency Hotlines</span>}>
          <div className="flex items-center justify-between gap-2 py-1">
            <a href="tel:1122" className="flex-1 p-2 rounded-[var(--radius-md)] bg-rose-50 border border-rose-200 text-center hover:bg-rose-100 transition-colors">
              <p className="font-black text-xs text-rose-700">1122</p>
              <span className="text-[10px] text-ink-600">Rescue</span>
            </a>
            <a href="tel:115" className="flex-1 p-2 rounded-[var(--radius-md)] bg-ink-50 border border-ink-200 text-center hover:bg-ink-100 transition-colors">
              <p className="font-black text-xs text-ink-800">115</p>
              <span className="text-[10px] text-ink-600">Edhi</span>
            </a>
            <a href="tel:1020" className="flex-1 p-2 rounded-[var(--radius-md)] bg-ink-50 border border-ink-200 text-center hover:bg-ink-100 transition-colors">
              <p className="font-black text-xs text-ink-800">1020</p>
              <span className="text-[10px] text-ink-600">Chhipa</span>
            </a>
          </div>
        </Card>

        {/* Pending Lab Orders Card */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-ink-900">Pending Labs</span>
              {pendingOrders.length > 0 && <Badge tone="info">{pendingOrders.length}</Badge>}
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : pendingOrders.length > 0 ? (
            <p className="text-xs font-medium text-ink-900 truncate">{pendingOrders[0]?.test_name || 'Lab Order'}</p>
          ) : (
            <p className="text-xs text-ink-500">No pending lab orders.</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Next Dose Today Card */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-ink-900">Today's Schedule</span>
              <Link to="/medicines" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
                Open Schedule &rarr;
              </Link>
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : todayDoses.length === 0 ? (
            <p className="text-xs text-ink-500 italic p-3">No doses scheduled for today.</p>
          ) : (
            <div className="space-y-2">
              {todayDoses.slice(0, 2).map((d) => {
                const med = medsMap[d.medicine_id];
                return (
                  <div key={d.id} className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] border border-ink-200 bg-ink-50">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-xs text-ink-900 truncate">
                        {med?.medicine_name || 'Prescription Medicine'}
                        {med?.strength ? ` ${med.strength}` : ''}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {formatDoseTime(d.scheduled_minutes)} • {d.status === 'taken' ? 'Taken' : 'Pending'}
                      </p>
                    </div>
                    <Badge tone={d.status === 'taken' ? 'ok' : 'warn'} className="shrink-0">
                      {d.status.toUpperCase()}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Access: Clinical Tools */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          to="/vitals"
          className="group p-4 rounded-2xl border border-ink-200 bg-white hover:border-rose-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center justify-center text-lg shrink-0">
              🩸
            </div>
            <div>
              <p className="text-xs font-bold text-ink-900 group-hover:text-rose-900 transition-colors">
                Chronic Vitals Radar
              </p>
              <p className="text-[11px] text-ink-500">Log blood sugar & BP</p>
            </div>
          </div>
        </Link>
        <Link
          to="/doctor/questions"
          className="group p-4 rounded-2xl border border-ink-200 bg-white hover:border-teal-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center text-lg shrink-0">
              ❓
            </div>
            <div>
              <p className="text-xs font-bold text-ink-900 group-hover:text-teal-900 transition-colors">
                Doctor Questions
              </p>
              <p className="text-[11px] text-ink-500">Prepare for your visit</p>
            </div>
          </div>
        </Link>
        <Link
          to="/doctor/second-opinion"
          className="group p-4 rounded-2xl border border-ink-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center justify-center text-lg shrink-0">
              🛡️
            </div>
            <div>
              <p className="text-xs font-bold text-ink-900 group-hover:text-indigo-900 transition-colors">
                Second-Opinion Pack
              </p>
              <p className="text-[11px] text-ink-500">Anonymized dossier export</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Health Milestone Badges */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
            🏅 Health Milestones
          </h2>
          <span className="text-[11px] text-ink-500">
            {dashboardAchievements.filter((a) => a.unlocked).length} / {dashboardAchievements.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dashboardAchievements.map((a) => (
            <MilestoneBadgeCard key={a.id} achievement={a} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <Disclaimer text={EXTRACTION_DISCLAIMER} />
      </div>
    </AppShell>
  );
}

function UiCatalogueScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <AppShell>
      <PageHeader
        title="UI Kit & Component Playground"
        description="All primitive components in default, hover, focus, disabled, error, and loading states."
        action={
          <Button variant="secondary" onClick={() => setToastOpen(true)}>
            Trigger Toast
          </Button>
        }
      />

      <Toast
        open={toastOpen}
        onClose={() => setToastOpen(false)}
        message="Dose marked as taken."
        tone="ok"
      />

      <div className="space-y-10">
        {/* Buttons */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading State</Button>
            <Button disabled>Disabled</Button>
            <IconButton aria-label="Add item" variant="secondary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </IconButton>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Badges (Semantic Tones)</h2>
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white">
            <Badge tone="neutral">Neutral Status</Badge>
            <Badge tone="ok">Within Range</Badge>
            <Badge tone="warn">Check this</Badge>
            <Badge tone="risk">Outside range</Badge>
            <Badge tone="info">Pending order</Badge>
          </div>
        </section>

        {/* Fields & Inputs */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Form Controls & Fields</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white">
            <Field id="ui-input-1" label="Medicine Name" hint="As printed on prescription">
              <Input
                placeholder="e.g. Augmentin 625mg"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </Field>

            <Field id="ui-input-2" label="Duration" error="Duration is required to generate schedule" required>
              <Input placeholder="e.g. 5 days" defaultValue="" />
            </Field>

            <Field id="ui-select-1" label="Frequency">
              <Select
                defaultValue="BD"
                options={[
                  { value: 'OD', label: 'OD — Once daily' },
                  { value: 'BD', label: 'BD — Twice daily' },
                  { value: 'TDS', label: 'TDS — Three times daily' },
                  { value: 'PRN', label: 'PRN — As needed' },
                ]}
              />
            </Field>

            <Field id="ui-textarea-1" label="Doctor Advice">
              <Textarea placeholder="Dietary restrictions or notes..." />
            </Field>
          </div>
        </section>

        {/* Overlays */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Overlays & Modals</h2>
          <div className="flex flex-wrap gap-3 p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open Dialog</Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Open Type-to-Confirm</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open Sheet</Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Quick Confirmation" description="This is a focused, centered dialog.">
            <p className="text-sm text-ink-700">Escape closes, focus is trapped and restored properly.</p>
          </Dialog>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete Medicine Course"
            description="This will remove the course and all future scheduled doses."
            requiredPhrase="DELETE"
            tone="danger"
            confirmLabel="Permanently Delete"
            onConfirm={() => setConfirmOpen(false)}
          />

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Medicine Information" description="Bottom sheet on mobile, drawer on desktop.">
            <div className="space-y-4">
              <p className="text-sm text-ink-700">Detailed guidance about taking this medication.</p>
              <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
            </div>
          </Sheet>
        </section>

        {/* Tabs */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Tabs</h2>
          <div className="p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white">
            <Tabs defaultValue="today">
              <TabsList>
                <TabsTrigger value="today">Today's Schedule</TabsTrigger>
                <TabsTrigger value="cabinet">Medicine Cabinet</TabsTrigger>
                <TabsTrigger value="history">Course History</TabsTrigger>
              </TabsList>
              <TabsContent value="today">
                <p className="text-sm text-ink-700 p-2">Today's timed doses content rendered here.</p>
              </TabsContent>
              <TabsContent value="cabinet">
                <p className="text-sm text-ink-700 p-2">Current medicines and PRN cabinet content.</p>
              </TabsContent>
              <TabsContent value="history">
                <p className="text-sm text-ink-700 p-2">Completed courses from the past.</p>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        {/* Skeletons */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Loading Skeletons</h2>
          <div className="space-y-2 p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </section>

        {/* States: Empty, Error */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Empty & Error States</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmptyState
              heading="No prescriptions recorded"
              description="Capture your first paper prescription with your camera or enter details manually."
              action={<Button size="sm">Capture Prescription</Button>}
            />
            <ErrorState
              title="Failed to load lab results"
              message="Could not connect to the records server. You can retry or check your offline cache."
              onRetry={() => {}}
            />
          </div>
        </section>

        {/* Disclaimers & Notes */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">Standard Disclaimers</h2>
          <div className="space-y-2">
            <Disclaimer text={EXTRACTION_DISCLAIMER} />
            <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
            <Disclaimer text={REPORT_OUT_OF_RANGE_NOTE} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Auth Routes (Redirects to / if already logged in) */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <SignUpPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />

        {/* Standalone Public Doctor Share Link */}
        {/* `/share/verify` is declared first so it is not captured by `:token`. */}
        <Route path="/share/verify" element={<ShareVerifyPage />} />
        <Route path="/share/:token" element={<PublicShareView />} />

        {/* Home: Landing for guests, Dashboard for authed users */}
        <Route
          path="/"
          element={
            <HomeRoute />
          }
        />
        <Route
          path="/landing"
          element={
            <LandingPage />
          }
        />
        <Route
          path="/__ui"
          element={
            <ProtectedRoute>
              <UiCatalogueScreen />
            </ProtectedRoute>
          }
        />

        {/* Smart Medical AI Assistant */}
        <Route
          path="/assistant"
          element={
            <ProtectedRoute>
              <AssistantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <AssistantPage />
            </ProtectedRoute>
          }
        />

        {/* Prescriptions & Doctor Visits */}
        <Route
          path="/prescriptions/new"
          element={
            <ProtectedRoute>
              <CapturePrescriptionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prescriptions/review"
          element={
            <ProtectedRoute>
              <ReviewPrescriptionPage />
            </ProtectedRoute>
          }
        />

        {/* Medicines & Schedules */}
        <Route
          path="/medicines"
          element={
            <ProtectedRoute>
              <TodaySchedulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicines/cabinet"
          element={
            <ProtectedRoute>
              <MedicineCabinetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicines/:id"
          element={
            <ProtectedRoute>
              <MedicineDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Reports & History */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/new"
          element={
            <ProtectedRoute>
              <CaptureReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/review"
          element={
            <ProtectedRoute>
              <ReviewReportPage />
            </ProtectedRoute>
          }
        />

        {/* Unified Timeline */}
        <Route
          path="/timeline"
          element={
            <ProtectedRoute>
              <TimelinePage />
            </ProtectedRoute>
          }
        />

        {/* Healthcare Financial & Expense Tracker */}
        <Route
          path="/finances"
          element={
            <ProtectedRoute>
              <FinancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance"
          element={
            <ProtectedRoute>
              <FinancePage />
            </ProtectedRoute>
          }
        />

        {/* Doctor Directory & Timelines */}
        <Route
          path="/doctors"
          element={
            <ProtectedRoute>
              <DoctorDirectoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor"
          element={
            <ProtectedRoute>
              <DoctorBriefPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brief"
          element={
            <ProtectedRoute>
              <DoctorBriefPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor-brief"
          element={
            <ProtectedRoute>
              <DoctorBriefPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/share"
          element={
            <ProtectedRoute>
              <ShareManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Clinical Tools: Symptoms, Vitals & Search */}
        <Route
          path="/vitals"
          element={
            <ProtectedRoute>
              <VitalsTrackerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/questions"
          element={
            <ProtectedRoute>
              <DoctorQuestionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/second-opinion"
          element={
            <ProtectedRoute>
              <SecondOpinionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/symptoms"
          element={
            <ProtectedRoute>
              <SymptomTriagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <SearchRecordsPage />
            </ProtectedRoute>
          }
        />

        {/* Settings & Danger Zone */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Catch-All Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
