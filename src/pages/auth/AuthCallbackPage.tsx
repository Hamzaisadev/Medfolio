import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { CheckIcon, AlertTriangleIcon } from '../../components/ui/icons';

/**
 * Auth Callback Page — handles redirects from Supabase email links:
 * - Email verification after signup
 * - Password reset links
 * - Magic links
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callbackType, setCallbackType] = useState<'signup' | 'recovery' | 'unknown'>('unknown');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    let timeout: ReturnType<typeof setTimeout>;

    async function handleCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const type = url.searchParams.get('type') || (url.pathname.includes('recovery') ? 'recovery' : 'signup');
        const isRecovery = type === 'recovery' || url.searchParams.get('next')?.includes('settings');

        setCallbackType(isRecovery ? 'recovery' : 'signup');

        // 1. First check if Supabase's detectSessionInUrl already established an active session
        const { data: initialSessionData } = await supabase.auth.getSession();
        let session = initialSessionData.session;

        // 2. If no session yet and a PKCE authorization code is present in URL, exchange it
        if (!session && code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn('Direct code exchange attempt:', exchangeError.message);
            // Double check if session was established concurrently
            const { data: retryCheck } = await supabase.auth.getSession();
            if (retryCheck.session) {
              session = retryCheck.session;
            } else {
              // Only fail if there really is no active session
              console.error('Code exchange failed with no session:', exchangeError);
              setErrorMessage(exchangeError.message);
              setStatus('error');
              return;
            }
          } else {
            const { data: newSessionData } = await supabase.auth.getSession();
            session = newSessionData.session;
          }
        }

        // 3. Fallback brief retry if session is propagating
        if (!session) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          const { data: finalRetry } = await supabase.auth.getSession();
          session = finalRetry.session;
        }

        if (!session) {
          setErrorMessage('Verification link may have expired or is already used. Please try signing in.');
          setStatus('error');
          return;
        }

        // Clean up code from browser URL without triggering a page reload
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {
          // Ignore history state errors if restricted
        }

        setStatus('success');

        timeout = setTimeout(() => {
          if (isRecovery) {
            navigate('/settings', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }, 1200);
      } catch (err) {
        console.error('Auth callback processing error:', err);
        setErrorMessage('Something went wrong during verification. Please try signing in.');
        setStatus('error');
      }
    }

    handleCallback();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <AppShell>
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <Logo size="lg" />
            </div>
          </div>

          <Card className="p-8 shadow-sm glass-card border border-line text-center space-y-4">
            {status === 'loading' && (
              <>
                <div className="flex justify-center">
                  <div className="w-10 h-10 border-4 border-accent-subtle border-t-accent rounded-full animate-spin" />
                </div>
                <p className="text-sm text-content font-medium">
                  Verifying your account...
                </p>
                <p className="text-xs text-content-subtle">
                  This will only take a moment.
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                  <CheckIcon size={32} />
                </div>
                <h2 className="text-xl font-black text-content">
                  {callbackType === 'recovery' ? 'Password Reset Ready' : 'Email Verified!'}
                </h2>
                <p className="text-sm text-content-muted">
                  {callbackType === 'recovery'
                    ? 'Redirecting you to update your password...'
                    : 'Your account is activated. Redirecting to your dashboard...'}
                </p>
                <div className="flex justify-center pt-2">
                  <div className="w-6 h-6 border-3 border-accent-subtle border-t-accent rounded-full animate-spin" />
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                  <AlertTriangleIcon size={32} />
                </div>
                <h2 className="text-xl font-black text-content">
                  Verification Failed
                </h2>
                <p className="text-sm text-content-muted">
                  {errorMessage || 'The verification link may have expired or is invalid.'}
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant="primary"
                    className="w-full h-12 text-sm font-bold"
                    onClick={() => navigate('/signup', { replace: true })}
                  >
                    Try Signing Up Again
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full h-12 text-sm font-semibold"
                    onClick={() => navigate('/login', { replace: true })}
                  >
                    Go to Sign In
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
