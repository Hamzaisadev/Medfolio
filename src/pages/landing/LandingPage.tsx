import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CameraIcon,
  LabFlaskIcon,
  MedicineIcon,
  ClockIcon,
  ReceiptIcon,
  LinkIcon,
  QuestionIcon,
  FileTextIcon,
  TargetIcon,
  StethoscopeIcon,
  BarChartIcon,
  ZapIcon,
  BrainIcon,
  CheckCircleIcon,
  LockIcon,
  ShieldIcon,
  WifiIcon,
  FlameIcon,
  TrophyIcon,
  AlertTriangleIcon,
  HeartPulseIcon,
  UserIcon,
  SparklesIcon,
  CheckIcon,
} from '../../components/ui/icons';

/* ─── Intersection Observer Hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting) {
        setIsVisible(true);
        obs.unobserve(el);
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

/* ─── Reveal-on-scroll wrapper ─── */
function Reveal({
  children,
  delayMs = 0,
  className = '',
  distance = 6,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
  distance?: 6 | 8;
}) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : `opacity-0 ${distance === 8 ? 'translate-y-8' : 'translate-y-6'}`
      } ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Animated Counter ─── */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useInView();
  useEffect(() => {
    if (!isVisible) return;
    let frame: number;
    const duration = 1800;
    const start = performance.now();
    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isVisible, target]);
  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Section Wrapper ─── */
function Section({
  children,
  className = '',
  id,
  dark = false,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  dark?: boolean;
}) {
  const { ref, isVisible } = useInView();
  return (
    <section
      id={id}
      ref={ref}
      className={`relative px-6 py-20 sm:py-28 lg:py-36 scroll-mt-20 transition-all duration-1000 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${dark ? 'bg-ink-900 text-white' : 'bg-white text-ink-900'} ${className}`}
    >
      <div className="max-w-6xl mx-auto">{children}</div>
    </section>
  );
}

/* ─── Feature Card ─── */
function FeatureCard({
  icon,
  title,
  desc,
  gradient,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  gradient: string;
  delay?: number;
}) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`group relative p-6 rounded-3xl border border-ink-200/60 bg-white hover:shadow-xl transition-all duration-700 cursor-default ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div
        className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`}
      />
      <div className="relative z-10">
        <div className="mb-4 inline-flex p-3 rounded-2xl bg-ink-50/80 border border-ink-100 group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <h3 className="text-base font-bold text-ink-900 mb-2">{title}</h3>
        <p className="text-sm text-ink-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LANDING PAGE — 10 Sections
   ═══════════════════════════════════════════════ */

export function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden selection:bg-teal-200 selection:text-teal-900">
      {/* ═══════════════════════════════════════
           FLOATING NAVBAR
         ═══════════════════════════════════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrollY > 20
            ? 'bg-white/90 backdrop-blur-xl border-b border-ink-200/60 shadow-xs'
            : 'bg-white/60 backdrop-blur-md border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-teal-600 to-emerald-500 flex items-center justify-center shadow-md">
              <span className="text-white text-sm font-black">M</span>
            </div>
            <span className="text-lg font-black tracking-tight text-ink-900">Medfolio</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-7 text-sm font-semibold text-ink-600">
            <a href="#features" className="hover:text-teal-800 transition-colors">Features</a>
            <a href="#assistant" className="hover:text-teal-800 transition-colors">Assistant</a>
            <a href="#safety-boundaries" className="hover:text-teal-800 transition-colors">Safety & Ethics</a>
            <a href="#vitals" className="hover:text-teal-800 transition-colors">Vitals</a>
            <a href="#security" className="hover:text-teal-800 transition-colors">Security</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-bold text-ink-700 hover:text-teal-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 text-sm font-bold text-white bg-linear-to-r from-teal-700 to-teal-600 rounded-xl hover:from-teal-800 hover:to-teal-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-ink-100 transition-colors"
          >
            <svg className="w-5 h-5 text-ink-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-ink-200/50 px-6 py-4 space-y-3 animate-in slide-in-from-top">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800">Features</a>
            <a href="#assistant" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800">Assistant</a>
            <a href="#safety-boundaries" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800">Safety & Ethics</a>
            <a href="#vitals" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800">Vitals</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800">Security</a>
            <div className="pt-2 border-t border-ink-200/50 flex gap-3">
              <Link to="/login" className="flex-1 text-center px-4 py-2.5 text-sm font-bold rounded-xl border border-ink-200 text-ink-700">Sign In</Link>
              <Link to="/signup" className="flex-1 text-center px-4 py-2.5 text-sm font-bold rounded-xl bg-teal-700 text-white">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════
           SECTION 1 — HERO
         ═══════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-1rem)] flex flex-col justify-center items-center px-6 pt-32 pb-20 sm:pt-36 sm:pb-24 overflow-hidden">
        {/* Background Gradient Orbs */}
        <div
          className="absolute top-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-linear-to-br from-teal-200/40 to-emerald-100/30 blur-3xl pointer-events-none"
          style={{ transform: `translateY(${scrollY * 0.15}px)` }}
        />
        <div
          className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] rounded-full bg-linear-to-tr from-blue-100/30 to-indigo-100/20 blur-3xl pointer-events-none"
          style={{ transform: `translateY(${scrollY * -0.1}px)` }}
        />
        <div
          className="absolute top-[30%] left-[50%] w-[300px] h-[300px] rounded-full bg-linear-to-tr from-rose-100/20 to-amber-100/15 blur-3xl pointer-events-none"
          style={{ transform: `translate(-50%, ${scrollY * 0.08}px)` }}
        />

        <div className="relative z-10 text-center max-w-4xl mx-auto my-auto flex flex-col items-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50/90 backdrop-blur-md border border-teal-200/80 mb-6 sm:mb-8 shadow-xs animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold text-teal-900 tracking-wider uppercase">Your Personal Health Operating System</span>
          </div>

          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-ink-900 leading-[1.08] mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000"
          >
            Every prescription.{' '}
            <br className="hidden sm:block" />
            <span className="bg-linear-to-r from-teal-700 via-teal-600 to-emerald-500 bg-clip-text text-transparent">
              Every report.
            </span>{' '}
            <br className="hidden sm:block" />
            One intelligent record.
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-ink-600 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Snap a prescription slip or lab report. Our clinical engine extracts, organizes, and tracks every
            medication, biomarker, and doctor visit — so you walk into every consultation fully prepared.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-400">
            <Link
              to="/signup"
              className="w-full sm:w-auto group px-8 py-3.5 sm:py-4 text-base font-bold text-white bg-linear-to-r from-teal-700 to-teal-600 rounded-2xl shadow-lg hover:shadow-xl hover:from-teal-800 hover:to-teal-700 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            >
              Start Your Health Record
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto text-center px-8 py-3.5 sm:py-4 text-base font-bold text-ink-700 border border-ink-200 bg-white/70 backdrop-blur-xs rounded-2xl hover:bg-ink-50 transition-all"
            >
              Explore Features
            </a>
          </div>

          {/* Floating Stats Banner */}
          <div className="mt-12 sm:mt-16 p-4 sm:p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-ink-200/70 shadow-sm flex flex-wrap items-center justify-center gap-6 sm:gap-12 animate-in fade-in duration-1000 delay-700">
            <div className="text-center min-w-[90px]">
              <p className="text-2xl sm:text-4xl font-black text-ink-900"><AnimatedCounter target={13} /></p>
              <p className="text-[10px] sm:text-xs font-bold text-ink-500 uppercase tracking-wider mt-1">Clinical Tables</p>
            </div>
            <div className="w-px h-8 sm:h-10 bg-ink-200" />
            <div className="text-center min-w-[90px]">
              <p className="text-2xl sm:text-4xl font-black text-ink-900"><AnimatedCounter target={256} /></p>
              <p className="text-[10px] sm:text-xs font-bold text-ink-500 uppercase tracking-wider mt-1">Bit AES Encryption</p>
            </div>
            <div className="w-px h-8 sm:h-10 bg-ink-200" />
            <div className="text-center min-w-[90px]">
              <p className="text-2xl sm:text-4xl font-black text-ink-900"><AnimatedCounter target={100} suffix="%" /></p>
              <p className="text-[10px] sm:text-xs font-bold text-ink-500 uppercase tracking-wider mt-1">Offline Capable</p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-8 text-center animate-bounce">
          <a href="#features" aria-label="Scroll to features" className="inline-block p-1 text-ink-400 hover:text-teal-700 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </section>

      {/* ═══════════════════════════════════════
           SECTION 2 — CORE FEATURES GRID
         ═══════════════════════════════════════ */}
      <Section id="features">
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-3">
            Clinical-Grade Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            Everything your health record should be
          </h2>
          <p className="text-base text-ink-600 mt-4 max-w-2xl mx-auto">
            Designed by patients, for patients. Every feature maps to a real clinical workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<CameraIcon className="w-6 h-6 text-teal-600" />}
            title="Snap & Extract Prescriptions"
            desc="Photograph any handwritten doctor slip. Medicine names, dosages, frequencies and instructions are read off the paper and filled in for you in seconds."
            gradient="bg-linear-to-br from-teal-50/50 to-emerald-50/30"
            delay={0}
          />
          <FeatureCard
            icon={<LabFlaskIcon className="w-6 h-6 text-blue-600" />}
            title="Lab Report Intelligence"
            desc="Upload lab reports and instantly see which biomarkers are out of range with visual flagging, reference ranges, and trend charts."
            gradient="bg-linear-to-br from-blue-50/50 to-indigo-50/30"
            delay={100}
          />
          <FeatureCard
            icon={<MedicineIcon className="w-6 h-6 text-amber-600" />}
            title="Smart Dose Schedule"
            desc="Auto-generated dose timeline with morning, afternoon, evening, and bedtime buckets. One-tap mark-as-taken with skip reasons."
            gradient="bg-linear-to-br from-amber-50/50 to-orange-50/30"
            delay={200}
          />
          <FeatureCard
            icon={<ClockIcon className="w-6 h-6 text-purple-600" />}
            title="Clinical Timeline"
            desc="A living longitudinal record of every visit, prescription, lab test, and medicine change — your complete health story in one scroll."
            gradient="bg-linear-to-br from-purple-50/50 to-violet-50/30"
            delay={300}
          />
          <FeatureCard
            icon={<ReceiptIcon className="w-6 h-6 text-emerald-600" />}
            title="Medical Expense Tracker"
            desc="Track every rupee spent on consultations, medicines, and lab tests. Monthly spend analysis with category breakdowns."
            gradient="bg-linear-to-br from-emerald-50/50 to-green-50/30"
            delay={400}
          />
          <FeatureCard
            icon={<LinkIcon className="w-6 h-6 text-indigo-600" />}
            title="Secure Share via PIN & QR"
            desc="Generate time-limited access links with 6-digit PINs or scannable QR codes. Auto-expires after your set window."
            gradient="bg-linear-to-br from-indigo-50/50 to-blue-50/30"
            delay={500}
          />
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 3 — AI ASSISTANT SPOTLIGHT
         ═══════════════════════════════════════ */}
      <Section id="assistant" dark>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-400 mb-4">
              Reads Handwritten Prescriptions
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Your personal health<br />
              <span className="bg-linear-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                intelligence assistant
              </span>
            </h2>
            <p className="text-base text-ink-400 mt-6 leading-relaxed">
              Ask questions about your medications, lab results, or dosage instructions. The assistant
              cross-references your actual clinical records to deliver grounded,
              evidence-aware explanations — never generic hallucinations.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  icon: <MedicineIcon className="w-5 h-5 text-teal-400" />,
                  title: 'Drug Interaction Radar',
                  desc: 'Flags potential combinations in active prescriptions for your doctor to review',
                },
                {
                  icon: <LabFlaskIcon className="w-5 h-5 text-blue-400" />,
                  title: 'Biomarker Trend Analysis',
                  desc: 'Identifies velocity changes and evaluates against clinical reference intervals',
                },
                {
                  icon: <QuestionIcon className="w-5 h-5 text-amber-400" />,
                  title: 'Smart Doctor Questions',
                  desc: 'Generates targeted clinical questions for your next consultation',
                },
                {
                  icon: <FileTextIcon className="w-5 h-5 text-purple-400" />,
                  title: 'Second-Opinion Dossier',
                  desc: 'Creates anonymized clinical packages with one click for specialist review',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-teal-900/50 transition-colors">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-ink-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/signup"
              className="inline-flex items-center gap-2 mt-10 px-6 py-3 text-sm font-bold text-teal-950 bg-linear-to-r from-teal-400 to-emerald-400 rounded-xl hover:from-teal-300 hover:to-emerald-300 transition-all shadow-lg"
            >
              Explore Clinical Assistant
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Mock Chat Interface */}
          <div className="relative">
            <div className="bg-ink-800 rounded-3xl border border-ink-700/50 shadow-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-700/50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">M</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Medfolio Clinical Assistant</p>
                  <p className="text-[10px] text-teal-400">Cross-referencing verified records...</p>
                </div>
              </div>

              <div className="p-5 space-y-4 min-h-[380px]">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-teal-700 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[280px]">
                    <p className="text-xs text-teal-50 leading-relaxed">
                      Can I take my Metformin with the new antibiotic my doctor prescribed?
                    </p>
                  </div>
                </div>

                {/* Assistant Response */}
                <div className="flex justify-start">
                  <div className="bg-ink-700/60 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[320px] border border-ink-600/30">
                    <p className="text-xs text-ink-200 leading-relaxed">
                      Based on your active prescriptions, you are taking{' '}
                      <span className="font-bold text-teal-400">Metformin 500mg BD</span> and newly added{' '}
                      <span className="font-bold text-amber-400">Augmentin 625mg TDS</span>.
                    </p>
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
                      <AlertTriangleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-amber-400">Moderate Interaction Note</p>
                        <p className="text-[10px] text-ink-300 mt-0.5 leading-relaxed">
                          Amoxicillin-Clavulanate may slightly alter glucose readings. Monitor blood sugar closely during the course and inform your physician if levels spike.
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-ink-500 mt-2">
                      Source: Grounded in your 3 active prescriptions • Assistive only, consult physician
                    </p>
                  </div>
                </div>

                {/* Typing Indicator */}
                <div className="flex items-center gap-1.5 px-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:200ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce [animation-delay:400ms]" />
                </div>
              </div>
            </div>

            {/* Glow Effect */}
            <div className="absolute -inset-4 bg-linear-to-br from-teal-500/10 to-emerald-500/5 rounded-[2rem] blur-2xl -z-10" />
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 4 — CLINICAL SAFETY & AI BOUNDARIES (NOT A DOCTOR)
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="safety-boundaries" dark className="bg-ink-950 text-white overflow-hidden border-y border-ink-800/80">
        <div className="relative">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-black uppercase tracking-[0.2em] mb-6">
              <ShieldIcon className="w-4 h-4 text-teal-400" />
              04 — Clinical Safety & AI Boundaries
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
              Assisting your care,{' '}
              <span className="bg-linear-to-r from-teal-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                never replacing your doctor
              </span>
            </h2>
            <p className="text-base sm:text-lg text-ink-300 mt-6 leading-relaxed">
              Medfolio is a clinical organizer and patient assistance tool. We empower patients and doctors with organized data — we are <strong>not a diagnostic agent</strong> and do not prescribe treatments.
            </p>
          </div>

          {/* Two-Column Framework Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-12">
            {/* Left Card: How We Assist */}
            <div className="lg:col-span-5 flex flex-col justify-between p-8 rounded-3xl bg-ink-900/90 border border-ink-800 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-400" />
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                    <HeartPulseIcon className="w-5 h-5 text-teal-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">How Medfolio Assists You</h3>
                </div>

                <ul className="space-y-4 text-sm text-ink-300">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <span><strong>Accurate OCR Extraction:</strong> Transcribes doctor handwriting and lab reports with high fidelity for your confirmation.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <span><strong>Adherence & Timings:</strong> Schedules doses into morning, afternoon, evening and night buckets with meal relations.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <span><strong>Doctor Visit Readiness:</strong> Generates clean 1-page clinical dossiers so physicians have full longitudinal context.</span>
                  </li>
                </ul>
              </div>

              {/* Safety Guardrail Highlight */}
              <div className="mt-8 pt-6 border-t border-ink-800">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 block mb-1">
                  STRICT MEDICAL DISCLAIMER
                </span>
                <p className="text-xs text-ink-200 font-medium leading-relaxed">
                  Medfolio is an assistive tool. Always consult a certified healthcare professional before making medical decisions or modifying medications.
                </p>
              </div>
            </div>

            {/* Right Card: Human-in-the-Loop Workflow */}
            <div className="lg:col-span-7 flex flex-col justify-between p-8 rounded-3xl bg-ink-900/90 border border-ink-800 backdrop-blur-xl shadow-2xl">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-400 block mb-6">
                  HUMAN-IN-THE-LOOP SAFEGUARDS
                </span>

                {/* Workflow Diagram Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Step 1 */}
                  <div className="p-5 rounded-2xl bg-ink-950/80 border border-ink-800 flex items-start gap-3.5 hover:border-teal-500/40 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                      <UserIcon className="w-5 h-5 text-cyan-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">1. Patient Input</p>
                      <p className="text-xs text-ink-400 mt-0.5">Capture prescription slip, upload lab report, or log daily vitals</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-5 rounded-2xl bg-ink-950/80 border border-teal-500/30 flex items-start gap-3.5 hover:border-teal-400 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
                      <SparklesIcon className="w-5 h-5 text-teal-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-300">2. AI Assistance</p>
                      <p className="text-xs text-ink-400 mt-0.5">Grounded text extraction, interaction radar & reference range analysis</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-5 rounded-2xl bg-linear-to-br from-ink-950 to-teal-950/40 border border-teal-500/50 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/50 flex items-center justify-center text-teal-200 shrink-0">
                      <ShieldIcon className="w-5 h-5 text-teal-200" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">3. Human Review</p>
                      <p className="text-xs text-ink-400 mt-0.5">Zero silent commits: you review every field before saving to your profile</p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-5 rounded-2xl bg-ink-950/80 border border-emerald-500/30 flex items-start gap-3.5 hover:border-emerald-400 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                      <CheckCircleIcon className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-300">4. Doctor Collaboration</p>
                      <p className="text-xs text-ink-400 mt-0.5">Share tamper-evident records and dossiers directly with consulting physicians</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Assurance */}
              <div className="mt-6 pt-4 border-t border-ink-800/80 flex items-center justify-between text-xs text-ink-400">
                <span className="flex items-center gap-1.5">
                  <LockIcon className="w-3.5 h-3.5 text-teal-400" /> Zero silent commits • 100% Patient & Doctor Verified
                </span>
                <span className="text-teal-400 font-semibold">13 Clinical Tables</span>
              </div>
            </div>
          </div>

          {/* Winning Signal Banner */}
          <div className="p-5 sm:p-6 rounded-2xl bg-linear-to-r from-amber-500/15 via-ink-900 to-teal-500/15 border border-amber-500/30 text-center max-w-4xl mx-auto shadow-xl">
            <p className="text-xs sm:text-sm text-amber-200 font-medium">
              <strong className="text-amber-400 font-black uppercase tracking-wider mr-2">Core Clinical Principle:</strong>
              Medfolio enhances doctor-patient communication and medication compliance without ever pretending to replace medical care.
            </p>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 5 — CLINICAL VITALS RADAR
         ═══════════════════════════════════════ */}
      <Section id="vitals">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Mock Vitals Visualizer */}
          <div className="order-2 lg:order-1 relative">
            <div className="p-6 rounded-3xl bg-white border border-ink-200/60 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Vitals Telemetry</h3>
                  <p className="text-xs text-ink-500">Live clinical evaluation</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Target Met
                </span>
              </div>

              {/* Glucose Metric Card */}
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <TargetIcon className="w-4 h-4 text-teal-700" /> Fasting Glucose
                  </span>
                  <span className="text-xs text-teal-700 font-bold">ADA Target: 70–99</span>
                </div>
                <p className="text-2xl font-black text-teal-950">92 <span className="text-xs font-normal text-teal-700">mg/dL</span></p>
                <div className="mt-2 w-full bg-teal-200/60 rounded-full h-2">
                  <div className="bg-teal-600 h-2 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>

              {/* BP Metric Card */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <HeartPulseIcon className="w-4 h-4 text-blue-700" /> Blood Pressure
                  </span>
                  <span className="text-xs text-blue-700 font-bold">AHA Stage: Normal</span>
                </div>
                <p className="text-2xl font-black text-blue-950">118/78 <span className="text-xs font-normal text-blue-700">mmHg</span></p>
                <p className="text-[11px] text-blue-600 mt-1">Pulse: 72 bpm • Right Arm • Sitting</p>
              </div>
            </div>

            <div className="absolute -inset-4 bg-linear-to-tr from-teal-100/40 to-blue-100/30 rounded-[2.5rem] blur-xl -z-10" />
          </div>

          <div className="order-1 lg:order-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-4">
              Evidence-Based Standards
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight leading-tight">
              Clinical vitals tracking<br />
              <span className="bg-linear-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent">
                with automatic staging
              </span>
            </h2>
            <p className="text-base text-ink-600 mt-6 leading-relaxed">
              Log fasting, post-meal, random, and bedtime blood sugar readings. Track systolic, diastolic,
              pulse, arm, and posture for every blood pressure check. Every entry is instantly evaluated
              against ADA and AHA clinical standards.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: <TargetIcon className="w-5 h-5 text-teal-600" />, title: 'ADA Glycemic Targets', desc: 'Fasting, post-prandial, and random glucose evaluated in real time' },
                { icon: <StethoscopeIcon className="w-5 h-5 text-blue-600" />, title: 'AHA Blood Pressure Stages', desc: 'Normal, Elevated, Stage 1, Stage 2, and Hypertensive evaluation' },
                { icon: <BarChartIcon className="w-5 h-5 text-purple-600" />, title: 'Mean Arterial Pressure', desc: 'MAP computed automatically for organ perfusion insight' },
                { icon: <ZapIcon className="w-5 h-5 text-amber-600" />, title: 'Spike & Dip Detection', desc: 'Alerts when velocity changes exceed safe clinical thresholds' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-ink-50 border border-ink-100 shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink-900">{item.title}</h4>
                    <p className="text-[11px] text-ink-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 6 — PRESCRIPTION OCR & EXTRACTION
         ═══════════════════════════════════════ */}
      <Section className="bg-ink-50">
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-3">
            Computer Vision Pipeline
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            From doctor's handwriting to structured data
          </h2>
          <p className="text-base text-ink-600 mt-4 max-w-2xl mx-auto">
            Our multi-model extraction engine decodes medical handwriting with high accuracy, presenting each extracted field for your verification.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              icon: <CameraIcon className="w-8 h-8 text-teal-600" />,
              title: 'Snap or Upload',
              desc: 'Take a photo of any prescription slip, lab report, or medical document with your phone camera.',
              color: 'from-teal-500 to-teal-600',
            },
            {
              step: '02',
              icon: <BrainIcon className="w-8 h-8 text-indigo-600" />,
              title: 'Automatic Clinical Extraction',
              desc: 'Medicine names, dosages, frequencies, diagnoses and test results are identified and laid out for you to check.',
              color: 'from-indigo-500 to-indigo-600',
            },
            {
              step: '03',
              icon: <CheckCircleIcon className="w-8 h-8 text-emerald-600" />,
              title: 'Review & Confirm',
              desc: 'Every extraction is presented for human verification. You control exactly what gets saved to your record.',
              color: 'from-emerald-500 to-emerald-600',
            },
          ].map((step, i) => (
            <Reveal
              key={step.step}
              delayMs={i * 150}
              distance={8}
              className="relative p-8 rounded-3xl bg-white border border-ink-200/60 shadow-sm"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br ${step.color} text-white text-sm font-black mb-5`}>
                {step.step}
              </div>
              <div className="mb-4">{step.icon}</div>
              <h3 className="text-lg font-bold text-ink-900 mb-2">{step.title}</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{step.desc}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 7 — SECURITY & PRIVACY
         ═══════════════════════════════════════ */}
      <Section id="security" dark>
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-400 mb-3">
            Zero-Compromise Security
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Medical-grade data protection
          </h2>
          <p className="text-base text-ink-400 mt-4 max-w-2xl mx-auto">
            Your health data is the most sensitive information you own. We treat it that way.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <LockIcon className="w-6 h-6 text-teal-400" />, title: 'Row-Level Security', desc: 'Every database query is tenant-isolated. Users can only access their own records.' },
            { icon: <ShieldIcon className="w-6 h-6 text-emerald-400" />, title: 'SHA-256 Watermarking', desc: 'Every exported document carries a tamper-evident cryptographic verification hash.' },
            { icon: <ClockIcon className="w-6 h-6 text-indigo-400" />, title: 'Self-Destructing Shares', desc: 'Time-limited access links that auto-expire and can be instantly revoked.' },
            { icon: <WifiIcon className="w-6 h-6 text-amber-400" />, title: 'Offline Vault', desc: 'Full offline capability with local encrypted storage when connectivity drops.' },
          ].map((item, i) => (
            <Reveal
              key={item.title}
              delayMs={i * 100}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <div className="p-2.5 rounded-xl bg-white/10 w-fit mb-4">{item.icon}</div>
              <h4 className="text-sm font-bold text-white mb-2">{item.title}</h4>
              <p className="text-xs text-ink-400 leading-relaxed">{item.desc}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 8 — MILESTONES & ADHERENCE
         ═══════════════════════════════════════ */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 mb-4">
              Behavioral Health Science
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight leading-tight">
              Health milestones that{' '}
              <span className="bg-linear-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                celebrate your progress
              </span>
            </h2>
            <p className="text-base text-ink-600 mt-6 leading-relaxed">
              Unlock achievement badges for medication adherence streaks, blood sugar stability,
              blood pressure normalization, and safe drug interaction records.
              Positive reinforcement drives lasting behavioral change.
            </p>
          </div>

          {/* Badges Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: <FlameIcon className="w-6 h-6 text-amber-600" />, title: '7-Day Adherence Master', desc: 'Uninterrupted medication compliance for 7 days', level: 'bronze', unlocked: true },
              { icon: <TargetIcon className="w-6 h-6 text-teal-600" />, title: 'Glycemic Guardian', desc: '10 glucose logs within clinical target range', level: 'silver', unlocked: true },
              { icon: <HeartPulseIcon className="w-6 h-6 text-rose-600" />, title: 'Cardiovascular Anchor', desc: '10 normal blood pressure readings', level: 'silver', unlocked: false, progress: 60 },
              { icon: <TrophyIcon className="w-6 h-6 text-amber-500" />, title: 'Monthly Champion', desc: '30-day uninterrupted medication streak', level: 'gold', unlocked: false, progress: 40 },
            ].map((badge, i) => {
              const borderColor = badge.unlocked
                ? badge.level === 'gold' ? 'border-amber-400 bg-linear-to-br from-amber-50/80 to-white'
                : badge.level === 'silver' ? 'border-slate-300 bg-linear-to-br from-slate-50 to-white'
                : 'border-amber-700/30 bg-linear-to-br from-orange-50/50 to-white'
                : 'border-ink-200/60 bg-ink-50/50 opacity-70';
              return (
                <Reveal
                  key={badge.title}
                  delayMs={i * 100}
                  className={`p-4 rounded-2xl border ${borderColor}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white border border-ink-100 shadow-xs shrink-0">
                      {badge.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-ink-900 truncate">{badge.title}</h4>
                        {badge.unlocked && (
                          <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded-full border border-emerald-300">
                            <CheckIcon className="w-2.5 h-2.5 inline mr-0.5" /> Done
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-600 mt-1">{badge.desc}</p>
                      {!badge.unlocked && badge.progress != null && (
                        <div className="mt-2 w-full bg-ink-200/80 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-teal-700 h-1.5 rounded-full"
                            style={{ width: `${badge.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 9 — DOCTOR CONSULTATION TOOLS
         ═══════════════════════════════════════ */}
      <Section className="bg-ink-50">
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 mb-3">
            Doctor Visit Co-Pilot
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            Walk into every consultation prepared
          </h2>
          <p className="text-base text-ink-600 mt-4 max-w-2xl mx-auto">
            Never forget to ask a critical question again. Our clinical engine pre-generates
            personalized consultation checklists from your actual health data.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Smart Questions Card */}
          <div className="bg-white rounded-3xl border border-ink-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100">
                <QuestionIcon className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-900">Smart Doctor Question Generator</h3>
                <p className="text-[11px] text-ink-500">Auto-synthesized from your records</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {[
                { priority: 'HIGH', q: 'My ALT (SGPT) was reported at 78 U/L (above reference range). What does this indicate?', cat: 'Lab Test Inquiries' },
                { priority: 'MEDIUM', q: 'How long should I continue Metformin 500mg? Are routine liver tests needed?', cat: 'Prescription Review' },
                { priority: 'ROUTINE', q: 'What dietary changes best support my Type 2 Diabetes management?', cat: 'Long-term Management' },
              ].map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-ink-200/60 hover:border-teal-200 transition-colors">
                  <input type="checkbox" className="mt-1 h-3.5 w-3.5 rounded text-teal-800" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-teal-900 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">{q.cat}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        q.priority === 'HIGH' ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : q.priority === 'MEDIUM' ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-ink-100 text-ink-700 border-ink-200'
                      }`}>{q.priority}</span>
                    </div>
                    <p className="text-xs text-ink-900 font-semibold">{q.q}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Second Opinion Card */}
          <div className="bg-white rounded-3xl border border-ink-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-ink-100 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-50 border border-teal-100">
                <ShieldIcon className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-900">Second-Opinion Dossier Packager</h3>
                <p className="text-[11px] text-ink-500">Specialist-ready clinical bundle</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <input type="checkbox" checked readOnly className="h-3.5 w-3.5 rounded text-teal-800" />
                <span className="text-xs font-bold text-ink-700">Anonymize Patient Identity</span>
                <span className="text-[10px] text-emerald-700 font-bold ml-auto flex items-center gap-1">
                  <ShieldIcon className="w-3 h-3 text-emerald-700" /> SHA-256 Verified
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-ink-50/70 border border-ink-200/60">
                  <p className="text-[9px] uppercase font-bold text-ink-500">Patient</p>
                  <p className="font-bold text-ink-900 mt-0.5">Ahmed K. (Anonymized)</p>
                </div>
                <div className="p-3 rounded-xl bg-ink-50/70 border border-ink-200/60">
                  <p className="text-[9px] uppercase font-bold text-ink-500">Conditions</p>
                  <p className="font-bold text-ink-900 mt-0.5">Type 2 Diabetes</p>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 text-xs">
                <p className="font-bold text-indigo-950">Sections Included:</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-indigo-800">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 font-medium">Active Rx</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 font-medium">Lab Biomarkers</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 font-medium">Vitals Staging</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 10 — TRUST & STATS
         ═══════════════════════════════════════ */}
      <Section>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-3">
            Built for Real Patients
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight mb-16">
            Designed with clinical precision
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { value: 13, suffix: '', label: 'Supabase Tables', desc: 'Complete clinical schema' },
            { value: 50, suffix: '+', label: 'Health Features', desc: 'And growing weekly' },
            { value: 100, suffix: '%', label: 'Open Source', desc: 'Full transparency' },
            { value: 0, suffix: '', label: 'Tracking Cookies', desc: 'Zero surveillance' },
          ].map((stat, i) => (
            <Reveal
              key={stat.label}
              delayMs={i * 100}
              className="text-center p-8 rounded-3xl border border-ink-200/60 bg-white hover:shadow-md"
            >
              <p className="text-4xl sm:text-5xl font-black text-ink-900">
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-sm font-bold text-ink-700 mt-2">{stat.label}</p>
              <p className="text-xs text-ink-500 mt-1">{stat.desc}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════
           SECTION 11 — FINAL CTA
         ═══════════════════════════════════════ */}
      <section className="relative px-6 py-32 sm:py-40 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-teal-900 via-teal-800 to-emerald-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.2),rgba(255,255,255,0))]" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Your health story<br />
            deserves better than<br />
            <span className="bg-linear-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
              a shoebox of papers
            </span>
          </h2>
          <p className="text-lg text-teal-100/80 mt-6 max-w-xl mx-auto leading-relaxed">
            Start organizing your prescriptions, tracking your vitals, and walking into
            every doctor visit with a complete clinical picture.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              to="/signup"
              className="group px-10 py-4 text-base font-bold text-teal-950 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.97] flex items-center gap-2"
            >
              Create Your Free Account
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          <p className="text-xs text-teal-200/60 mt-8">
            No credit card required · Free forever for personal use · Your data stays yours
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════
           FOOTER
         ═══════════════════════════════════════ */}
      <footer className="bg-ink-900 border-t border-ink-800 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-teal-600 to-emerald-500 flex items-center justify-center">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <span className="text-sm font-bold text-ink-300">Medfolio Health OS</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-ink-500">
            <a href="#features" className="hover:text-teal-400 transition-colors">Features</a>
            <a href="#assistant" className="hover:text-teal-400 transition-colors">Assistant</a>
            <a href="#safety-boundaries" className="hover:text-teal-400 transition-colors">Safety & Ethics</a>
            <a href="#security" className="hover:text-teal-400 transition-colors">Security</a>
            <Link to="/login" className="hover:text-teal-400 transition-colors">Sign In</Link>
          </div>

          <p className="text-xs text-ink-600">
            © {new Date().getFullYear()} Medfolio. Built with clinical precision.
          </p>
        </div>
      </footer>
    </div>
  );
}
