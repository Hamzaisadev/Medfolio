import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import {
  ShieldCheck,
  FileText,
  Activity,
  CheckCircle2,
  Mail,
} from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithEmail, needsEmailVerification, pendingVerificationEmail, resendVerificationEmail, clearVerificationState } = useAuth();

  const initialEmail = (location.state as { email?: string })?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestSignUp, setSuggestSignUp] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuggestSignUp(false);
    setResendSuccess(false);

    const { error } = await signInWithEmail(trimmedEmail, password);

    if (error) {
      setErrorMessage(error);
      setIsLoading(false);
      if (error.toLowerCase().includes('incorrect') || error.toLowerCase().includes('invalid') || error.toLowerCase().includes('not found')) {
        setSuggestSignUp(true);
      }
    } else {
      navigate('/');
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = pendingVerificationEmail || email.trim();
    if (!targetEmail) return;

    setResendLoading(true);
    setResendSuccess(false);

    const { error } = await resendVerificationEmail(targetEmail);

    setResendLoading(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    }
  };

  const handleGoToSignUp = () => {
    navigate('/signup', { state: { email: email.trim() } });
  };

  return (
    <AppShell>
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Professional Medical OS Deck (Desktop) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col space-y-6 pr-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-subtle border border-accent/20 text-xs font-semibold text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Clinical Health OS
              </div>
              <h2 className="text-3xl font-black tracking-tight text-content leading-tight">
                Your medical history, <span className="gradient-text-teal">structured and actionable.</span>
              </h2>
              <p className="text-xs text-content-muted leading-relaxed">
                Digitize handwritten prescriptions, track laboratory biomarkers over time, and securely share verified health summaries.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-raised border border-line-strong">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-content">Multilingual Prescription OCR</p>
                  <p className="text-content-subtle text-[11px]">Instant extraction of medications, dosages, and schedules</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-raised border border-line-strong">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Activity size={18} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-content">ADA / AHA Biomarker Tracking</p>
                  <p className="text-content-subtle text-[11px]">Automatic range analysis for HbA1c, Lipids, and Blood Pressure</p>
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-content-subtle flex items-center gap-2">
              <ShieldCheck size={14} className="text-teal-600 shrink-0" />
              <span>Offline-first architecture with encrypted local storage</span>
            </div>
          </div>

          {/* Right Column: Sign In Form */}
          <div className="lg:col-span-7 w-full max-w-md mx-auto">
            <div className="text-center space-y-2 mb-6">
              <div className="flex justify-center mb-2">
                <Logo size="lg" />
              </div>
              <h1 className="text-2xl font-black text-content tracking-tight">Sign In to Medfolio</h1>
              <p className="text-xs text-content-muted">
                Access your prescriptions, doses, and diagnostic reports
              </p>
            </div>

            <Card className="p-6 sm:p-8 shadow-sm glass-card border border-line rounded-2xl">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-risk-bg border border-risk-border text-xs text-risk-text font-medium space-y-2">
                    <p>{errorMessage}</p>
                    {suggestSignUp && (
                      <div className="pt-1.5 border-t border-risk-border/50">
                        <button
                          type="button"
                          onClick={handleGoToSignUp}
                          className="font-bold text-accent hover:underline inline-flex items-center gap-1"
                        >
                          No account found. Create an account for {email} &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {needsEmailVerification && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-content space-y-2">
                    <p className="font-semibold text-amber-500 flex items-center gap-1.5">
                      <Mail size={14} />
                      <span>Email verification required</span>
                    </p>
                    <p className="text-content-muted text-[11px] leading-relaxed">
                      Your email{' '}
                      {pendingVerificationEmail && (
                        <span className="font-semibold text-content">{pendingVerificationEmail}</span>
                      )}{' '}
                      has not been verified yet. Check your inbox for the confirmation link.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs h-8 px-3"
                        loading={resendLoading}
                        onClick={handleResendVerification}
                      >
                        Resend Email
                      </Button>
                      {resendSuccess && (
                        <span className="text-accent text-[11px] font-medium">Link sent</span>
                      )}
                    </div>
                  </div>
                )}

                {resendSuccess && !needsEmailVerification && (
                  <div className="p-3 rounded-xl bg-accent-subtle border border-accent text-xs text-accent-onsubtle font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Verification email resent. Please check your inbox.</span>
                  </div>
                )}

                <Field id="login-email" label="Email Address" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (needsEmailVerification) clearVerificationState();
                      if (suggestSignUp) setSuggestSignUp(false);
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    disabled={isLoading}
                  />
                </Field>

                <Field id="login-password" label="Password" required>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content text-xs font-semibold select-none"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </Field>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-content-subtle">Forgot credentials?</span>
                  <Link to="/forgot-password" className="text-accent hover:text-accent-hover font-bold">
                    Reset password
                  </Link>
                </div>

                <Button type="submit" variant="primary" className="w-full h-12 text-sm font-bold tap-spring" loading={isLoading}>
                  Sign In
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-line text-center text-xs text-content-muted">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={handleGoToSignUp}
                  className="text-accent font-bold hover:underline inline-block"
                >
                  Create an account
                </button>
              </div>
            </Card>

            <div className="text-center text-[11px] text-content-subtle mt-4">
              Protected by patient data privacy standards & encrypted storage.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
