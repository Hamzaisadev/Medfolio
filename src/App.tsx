import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes';
import { AuthProvider, useAuth } from './lib/auth/AuthContext';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { registerServiceWorker } from './lib/notifications';
import { useDoseReminders } from './lib/notifications/useDoseReminders';
import { ThemeProvider } from './lib/theme/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Starts the dose reminder loop for the signed-in profile.
 *
 * Rendered inside AuthProvider (so it can read the profile) but outside the
 * router, since reminders are global rather than route-scoped.
 */
function DoseReminders() {
  const { user, profile } = useAuth();
  const userId = user?.id || profile?.user_id || '';
  const profileId = profile?.id || userId;

  useDoseReminders(profileId, userId);
  return null;
}

export default function App() {
  useEffect(() => {
    // public/sw.js existed but was never registered, so the PWA offline cache and
    // every notification were inert.
    registerServiceWorker();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OfflineBanner />
            <DoseReminders />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
