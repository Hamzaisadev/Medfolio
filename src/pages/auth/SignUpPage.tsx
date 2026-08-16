import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';

export function SignUpPage() {
  const navigate = useNavigate();
  const { signUpWithEmail } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other' | 'undisclosed'>('undisclosed');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error } = await signUpWithEmail(email, password, {
      fullName,
      sex,
      dateOfBirth: dateOfBirth || undefined,
    });

    if (error) {
      setErrorMessage(error.message || 'Failed to create account.');
      setIsLoading(false);
    } else {
      setSuccessMessage('Account created successfully! Redirecting...');
      setTimeout(() => {
        navigate('/');
      }, 1200);
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
            <h1 className="text-2xl font-black text-ink-900 tracking-tight">Create your Medfolio Account</h1>
            <p className="text-xs text-ink-500">
              Digitize your family prescriptions and keep continuous health records.
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

              <Field id="signup-name" label="Full Name" required>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                />
              </Field>

              <Field id="signup-email" label="Email Address" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field id="signup-password" label="Password (min 6 chars)" required>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Field id="signup-sex" label="Biological Sex">
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value as 'male' | 'female' | 'other' | 'undisclosed')}
                    className="w-full h-11 px-3 py-2 text-xs bg-surface-primary border border-ink-200 rounded-[var(--radius-md)] text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="undisclosed">Undisclosed</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </Field>

                <Field id="signup-dob" label="Date of Birth">
                  <Input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="text-xs"
                  />
                </Field>
              </div>

              <Button type="submit" variant="primary" className="w-full h-11 text-sm font-bold mt-2" loading={isLoading}>
                Create Account &rarr;
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-ink-100 text-center text-xs text-ink-500">
              Already have an account?{' '}
              <Link to="/login" className="text-teal-800 font-bold hover:underline">
                Sign In
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
