import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';

export function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await signInWithEmail(email, password);
    if (error) {
      setErrorMessage(error.message || 'Invalid email or password.');
      setIsLoading(false);
    } else {
      navigate('/');
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
            <h1 className="text-2xl font-black text-ink-900 tracking-tight">Sign In to Medfolio</h1>
            <p className="text-xs text-ink-500">
              Access your prescriptions, dose schedule, and diagnostic lab records.
            </p>
          </div>

          <Card className="p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-risk-bg border border-risk-border text-xs text-risk-text font-medium">
                  {errorMessage}
                </div>
              )}

              <Field id="login-email" label="Email Address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field id="login-password" label="Password" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>

              <div className="flex items-center justify-between text-xs pt-1">
                <Link to="/forgot-password" className="text-teal-700 hover:text-teal-900 font-semibold">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" variant="primary" className="w-full h-11 text-sm font-bold" loading={isLoading}>
                Sign In
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-ink-100 text-center text-xs text-ink-500">
              Don't have an account?{' '}
              <Link to="/signup" className="text-teal-800 font-bold hover:underline">
                Create an account
              </Link>
            </div>
          </Card>

          <div className="text-center text-[11px] text-ink-400">
            You can also continue using Medfolio as a local guest.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
