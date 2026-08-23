import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';

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

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    async function handleCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const type = url.searchParams.get('type');

        if (type === 'recovery') {
          setCallbackType('recovery');
        } else {
          setCallbackType('signup');
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Code exchange error:', error);
            setErrorMessage(error.message);
            setStatus('error');
            return;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session retrieval error:', sessionError);
          setErrorMessage(sessionError.message);
          setStatus('error');
          return;
        }

        if (!session) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const retry = await supabase.auth.getSession();

          if (!retry.data.session) {
            setErrorMessage('Verification link may have expired. Please try signing up again.');
            setStatus('error');
            return;
          }
        }

        setStatus('success');

        timeout = setTimeout(() => {
          if (callbackType === 'recovery' || type === 'recovery') {
            navigate('/settings', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }, 1500);
      } catch (err) {
        console.error('Auth callback error:', err);
        setErrorMessage('Something went wrong during verification. Please try again.');
        setStatus('error');
      }
    }

    handleCallback();

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [navigate, callbackType]);

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
                <div className="text-5xl">✅</div>
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
                <div className="text-5xl">⚠️</div>
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
