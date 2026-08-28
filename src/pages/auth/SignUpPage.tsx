import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { MedicalDatePicker } from '../../components/ui/MedicalDatePicker';
import {
  ShieldCheck,
  FileText,
  Activity,
  AlertTriangle,
  Mail,
  CheckCircle2,
} from 'lucide-react';

export function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUpWithEmail, resendVerificationEmail } = useAuth();

  const prefilledEmail = (location.state as { email?: string })?.email || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sex, setSex] = useState<'male' | 'female' | 'other' | 'undisclosed'>('undisclosed');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const hasLength = password.length >= 6;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const strengthScore = [hasLength, hasNumber, hasSpecial].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setErrorMessage('Please fill in your name, email, and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const { error, needsVerification } = await signUpWithEmail(trimmedEmail, password, {
      fullName: trimmedName,
      sex,
      dateOfBirth: dateOfBirth || undefined,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    if (needsVerification) {
      setVerificationEmail(trimmedEmail);
      setShowVerification(true);
      return;
    }

    navigate('/');
  };

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    const { error } = await resendVerificationEmail(verificationEmail);
    setResendLoading(false);

    if (error) {
      setErrorMessage(error);
    } else {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    }
  };

  // ------- Email Verification State Screen -------
  if (showVerification) {
    return (
      <AppShell>
        <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-3">
                <Logo size="lg" />
              </div>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-2">
                <Mail size={28} />
              </div>
              <h1 className="text-2xl font-black text-content tracking-tight">
                Verify your Email
              </h1>
              <p className="text-xs text-content-muted leading-relaxed">
                A verification link has been sent to{' '}
                <span className="font-semibold text-content">{verificationEmail}</span>.
                <br />
                Please open the link to activate your account.
              </p>
            </div>

            <Card className="p-6 sm:p-8 shadow-sm glass-card border border-line rounded-2xl space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-risk-bg border border-risk-border text-xs text-risk-text font-medium">
                  {errorMessage}
                </div>
              )}

              {resendSuccess && (
                <div className="p-3.5 rounded-xl bg-accent-subtle border border-accent text-xs text-accent-onsubtle font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Activation email resent. Please check your inbox.</span>
                </div>
              )}

              <div className="text-center space-y-3">
                <p className="text-xs text-content-subtle">
                  Did not receive the email? Check your spam folder or click below to resend.
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-11 text-xs font-semibold"
                  loading={resendLoading}
                  onClick={handleResendEmail}
                >
                  Resend Verification Email
                </Button>
              </div>

              <div className="pt-4 border-t border-line text-center text-xs text-content-muted">
                Already verified?{' '}
                <Link
                  to="/login"
                  state={{ email: verificationEmail }}
                  className="text-accent font-bold hover:underline"
                >
                  Sign In &rarr;
                </Link>
              </div>
            </Card>

            <div className="text-center text-[11px] text-content-subtle">
              Wrong email address?{' '}
              <button
                type="button"
                onClick={() => {
                  setShowVerification(false);
                  setErrorMessage(null);
                }}
                className="text-accent font-semibold hover:underline"
              >
                Change email address
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ------- Main Sign Up Form Screen -------
  return (
    <AppShell>
      <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Medical Deck (Desktop) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col space-y-6 pr-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-semibold text-teal-600">
                <ShieldCheck size={14} />
                <span>Patient Health Record Vault</span>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-content leading-tight">
                Unified patient records, <span className="gradient-text-teal">always accessible.</span>
              </h2>
              <p className="text-xs text-content-muted leading-relaxed">
                Take control of your prescriptions, diagnostic laboratory trends, and continuous medical history in one private portal.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-raised border border-line-strong">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-content">Intelligent Dose Engine</p>
                  <p className="text-content-subtle text-[11px]">Automatic frequency translation and medication tracking</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-raised border border-line-strong">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                  <Activity size={18} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-content">Biomarker Analytics & OCR</p>
                  <p className="text-content-subtle text-[11px]">Automatic evaluation against standard reference intervals</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-raised border border-line-strong">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-content">Clinical Red Flag Checks</p>
                  <p className="text-content-subtle text-[11px]">Guidance aligned with clinical emergency triage rules</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sign Up Form */}
          <div className="lg:col-span-7 w-full max-w-lg mx-auto">
            <div className="text-center space-y-1.5 mb-5">
              <div className="flex justify-center mb-2">
                <Logo size="lg" />
              </div>
              <h1 className="text-2xl font-black text-content tracking-tight">Create your Patient Account</h1>
              <p className="text-xs text-content-muted">
                Quick onboarding to set up your personal health record
              </p>
            </div>

            <Card className="p-6 sm:p-8 shadow-sm glass-card border border-line rounded-2xl overflow-visible">
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-risk-bg border border-risk-border text-xs text-risk-text font-medium">
                    {errorMessage}
                  </div>
                )}

                <Field id="signup-name" label="Full Name" required>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    required
                    disabled={isLoading}
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
                    disabled={isLoading}
                  />
                </Field>

                <Field id="signup-password" label="Password" required>
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        autoComplete="new-password"
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

                    {/* Clean Password Strength Bar */}
                    {password.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex gap-1 h-1 w-full bg-surface-hover rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              strengthScore === 1 ? 'w-1/3 bg-rose-500' : strengthScore === 2 ? 'w-2/3 bg-amber-500' : 'w-full bg-teal-600'
                            }`}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-content-subtle">
                          <span>
                            {strengthScore === 1 ? 'Weak' : strengthScore === 2 ? 'Moderate' : 'Strong'}
                          </span>
                          <span>{hasLength ? 'Minimum met' : '6+ characters required'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Field>

                {/* Clean Segmented Biological Sex Selector */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-sm font-semibold text-content block">Biological Sex</span>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Biological Sex">
                    {[
                      { id: 'male', label: 'Male' },
                      { id: 'female', label: 'Female' },
                      { id: 'undisclosed', label: 'Other / Undisclosed' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSex(item.id as 'male' | 'female' | 'other' | 'undisclosed')}
                        disabled={isLoading}
                        className={`h-11 rounded-[var(--radius-md)] border text-xs font-semibold flex items-center justify-center transition-all ${
                          sex === item.id
                            ? 'bg-accent text-accent-onaccent border-accent shadow-sm'
                            : 'bg-surface-raised border-line-strong text-content hover:bg-surface-hover'
                        }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Medical Date of Birth Picker */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-sm font-semibold text-content block">Date of Birth</span>
                  <MedicalDatePicker
                    id="signup-dob"
                    value={dateOfBirth}
                    onChange={setDateOfBirth}
                    mode="birthdate"
                    showAge
                    disabled={isLoading}
                  />
                </div>

                <Button type="submit" variant="primary" className="w-full h-12 text-sm font-bold mt-3 tap-spring" loading={isLoading}>
                  Create Account
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-line text-center text-xs text-content-muted">
                Already registered?{' '}
                <Link
                  to="/login"
                  state={{ email }}
                  className="text-accent font-bold hover:underline"
                >
                  Sign In
                </Link>
              </div>
            </Card>

            <div className="text-center text-[11px] text-content-subtle mt-4">
              Patient data is stored in compliance with standard clinical privacy safeguards.
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
