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

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSuccessMessage('Password reset link sent! Please check your email inbox.');
      }
    } catch {
      setErrorMessage('Failed to send password reset email. Please try again.');
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
            <h1 className="text-2xl font-black text-content tracking-tight">Reset Password</h1>
            <p className="text-xs text-content-muted">
              Enter the email address associated with your account.
            </p>
          </div>

          <Card className="p-6 sm:p-8 shadow-sm glass-card border border-line">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-risk-bg border border-risk-border text-xs text-risk-text font-medium">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-lg bg-accent-subtle border border-accent text-xs text-accent-onsubtle font-semibold">
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
                  disabled={isLoading}
                />
              </Field>

              <Button type="submit" variant="primary" className="w-full h-12 text-sm font-bold" loading={isLoading}>
                Send Reset Link
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-line text-center text-xs text-content-muted">
              Remember your password?{' '}
              <Link to="/login" className="text-accent font-bold hover:underline">
                Back to Sign In
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
