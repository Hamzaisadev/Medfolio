import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AppShell } from './components/layout/AppShell';
import { Skeleton, SkeletonMetricCard, SkeletonCardItem } from './components/ui/Skeleton';
import { useAuth } from './lib/auth/AuthContext';

// Lazy-loaded route components for code splitting.
const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
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
const VisitDetailPage = lazy(() =>
  import('./pages/visits/VisitDetailPage').then((m) => ({ default: m.VisitDetailPage }))
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
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const AuthCallbackPage = lazy(() =>
  import('./pages/auth/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage }))
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

/**
 * The component catalogue is a development aid. It is lazy-loaded like every other
 * route because importing its ~20 primitives eagerly pulled all of them into the
 * initial bundle, which defeated the code splitting for every real route.
 */
const UiCatalogueScreen = lazy(() =>
  import('./pages/dev/UiCataloguePage').then((m) => ({ default: m.UiCataloguePage }))
);

function RouteLoadingFallback() {
  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto py-2">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
        </div>
        <div className="space-y-3 pt-2">
          <SkeletonCardItem />
          <SkeletonCardItem />
        </div>
      </div>
    </AppShell>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoadingFallback />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoadingFallback />;
  return user ? <DashboardPage /> : <LandingPage />;
}

export function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 450, damping: 32 }}
          className="w-full flex-1 flex flex-col"
        >
          <Routes location={location} key={location.pathname}>
        {/* Auth */}
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
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Public doctor share link. `/share/verify` is declared first so it is
            not captured by `:token`. */}
        <Route path="/share/verify" element={<ShareVerifyPage />} />
        <Route path="/share/:token" element={<PublicShareView />} />

        {/* Home: landing for guests, dashboard for signed-in users */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/landing" element={<LandingPage />} />

        {/* Component catalogue: development only. */}
        {import.meta.env.DEV && (
          <Route
            path="/__ui"
            element={
              <ProtectedRoute>
                <UiCatalogueScreen />
              </ProtectedRoute>
            }
          />
        )}

        <Route
          path="/assistant"
          element={
            <ProtectedRoute>
              <AssistantPage />
            </ProtectedRoute>
          }
        />

        {/* Prescriptions */}
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

        {/* Medicines */}
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

        {/* Reports */}
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

        <Route
          path="/timeline"
          element={
            <ProtectedRoute>
              <TimelinePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visits/:id"
          element={
            <ProtectedRoute>
              <VisitDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/visits/:id"
          element={
            <ProtectedRoute>
              <VisitDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finances"
          element={
            <ProtectedRoute>
              <FinancePage />
            </ProtectedRoute>
          }
        />

        {/* Doctor tools. One canonical path each — `/doctor`, `/brief`,
            `/doctor-brief`, `/finance` and `/chat` were duplicate aliases. */}
        <Route
          path="/doctors"
          element={
            <ProtectedRoute>
              <DoctorDirectoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/brief"
          element={
            <ProtectedRoute>
              <DoctorBriefPage />
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
          path="/share"
          element={
            <ProtectedRoute>
              <ShareManagementPage />
            </ProtectedRoute>
          }
        />

        {/* Clinical tools */}
        <Route
          path="/vitals"
          element={
            <ProtectedRoute>
              <VitalsTrackerPage />
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
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Redirects for the retired aliases, so existing links and bookmarks
            keep working instead of hitting the 404 page. */}
        <Route path="/chat" element={<Navigate to="/assistant" replace />} />
        <Route path="/finance" element={<Navigate to="/finances" replace />} />
        <Route path="/doctor" element={<Navigate to="/doctor/brief" replace />} />
        <Route path="/brief" element={<Navigate to="/doctor/brief" replace />} />
        <Route path="/doctor-brief" element={<Navigate to="/doctor/brief" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}
