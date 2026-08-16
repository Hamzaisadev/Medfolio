import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase/client';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage('Password reset link sent! Please check your email inbox.');
      }
    } catch {
      setErrorMessage('Failed to send password reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-black text-ink-900 tracking-tight">Reset Password</h1>
            <p className="text-xs text-ink-500">
              Enter the email address associated with your account.
            </p>
          </div>

          <Card className="p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-risk-bg border border-risk-border text-xs text-risk-text font-medium">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 font-semibold">
                  {successMessage}
                </div>
              )}

              <Field id="forgot-email" label="Email Address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </Field>

              <Button type="submit" variant="primary" className="w-full h-11 text-sm font-bold" loading={isLoading}>
                Send Reset Link
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-ink-100 text-center text-xs text-ink-500">
              Remember your password?{' '}
              <Link to="/login" className="text-teal-800 font-bold hover:underline">
                Back to Sign In
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
