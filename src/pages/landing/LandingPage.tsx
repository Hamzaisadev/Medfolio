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
  TargetIcon,
  StethoscopeIcon,
  BarChartIcon,
  ZapIcon,
  BrainIcon,
  CheckCircleIcon,
  LockIcon,
  ShieldIcon,
  WifiIcon,
  HeartPulseIcon,
  UserIcon,
  SparklesIcon,
  DoctorIcon,
  AlertTriangleIcon,
  ActivityIcon,
  MealIcon,
  ArrowRightIcon,
} from '../../components/ui/icons';

/* ─── Intersection Observer Hook ─── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
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
  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
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
      className={`relative px-6 py-20 sm:py-28 lg:py-32 scroll-mt-20 transition-all duration-1000 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${dark ? 'bg-ink-950 text-white' : 'bg-white text-ink-900'} ${className}`}
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
  tag,
  gradient,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  tag?: string;
  gradient: string;
  delay?: number;
}) {
  const { ref, isVisible } = useInView();
  return (
    <div
      ref={ref}
      className={`group relative p-6 sm:p-7 rounded-3xl border border-ink-200/70 bg-white hover:border-teal-500/40 hover:shadow-xl transition-all duration-500 cursor-default ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div
        className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${gradient}`}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-2xl bg-ink-50/90 border border-ink-100 group-hover:scale-105 transition-transform">
            {icon}
          </div>
          {tag && (
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200/70">
              {tag}
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-ink-900 mb-2 group-hover:text-teal-900 transition-colors">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Shifa AI Interactive Terminal Query Presets ─── */
interface ShifaQueryScenario {
  id: string;
  label: string;
  icon: ReactNode;
  badge: string;
  userPrompt: string;
  aiResponse: string;
  highlightTitle: string;
  highlightDesc: string;
  highlightType: 'ok' | 'alert' | 'info' | 'trajectory';
  sources: Array<{ name: string; tag: string; color: string }>;
  suggestedActions: string[];
}

const SHIFA_SCENARIOS: ShifaQueryScenario[] = [
  {
    id: 'glucose-regimen',
    label: 'Glucose & Metformin Mesh',
    icon: <BarChartIcon size={14} />,
    badge: 'Clinical Trajectory',
    userPrompt: 'What is my fasting glucose trend and how does it correlate with my Metformin schedule?',
    aiResponse:
      'Your latest fasting blood glucose was 108 mg/dL (6.0 mmol/L) on Aug 28, falling within the Impaired / Near Target range (ADA fasting goal: 70–99 mg/dL).',
    highlightTitle: 'Regimen Correlation & Glycemic Velocity',
    highlightDesc:
      'Coupled with your active Metformin 500mg BD and recent HbA1c of 6.1%, your 30-day fasting baseline improved by 14 mg/dL with zero reported hypoglycemic dips.',
    highlightType: 'ok',
    sources: [
      { name: '🩸 Vitals: Fasting Glucose (108 mg/dL)', tag: 'Aug 28', color: 'text-teal-300' },
      { name: '💊 Rx: Metformin 500mg BD', tag: 'Active', color: 'text-emerald-300' },
      { name: '🔬 Lab: HbA1c 6.1%', tag: 'Aug 20', color: 'text-blue-300' },
    ],
    suggestedActions: [
      'Show 30-day glucose scatter chart',
      'Generate physician review note',
      'Remind morning dose with breakfast',
    ],
  },
  {
    id: 'sentinel-safety',
    label: 'Sentinel Overdose Guard',
    icon: <AlertTriangleIcon size={14} />,
    badge: 'Sentinel Engine',
    userPrompt: 'Is it safe to take Panadol 500mg along with my prescribed Calpol syrup and Disprin?',
    aiResponse:
      'Sentinel Safety Alert: Panadol and Calpol both contain the identical active molecule Paracetamol (Acetaminophen). Taking both simultaneously creates a cumulative daily overdose risk.',
    highlightTitle: 'Cumulative Daily Dose: 2,500mg / 4,000mg Max',
    highlightDesc:
      'Calculated Paracetamol load: Panadol (2x 500mg = 1000mg) + Calpol (1500mg). Do not take overlapping brand names. Aspirin (Disprin) also increases gastric risk with concurrent NSAIDs.',
    highlightType: 'alert',
    sources: [
      { name: '🛡️ Sentinel: Generic Molecule Registry', tag: 'BNF Verified', color: 'text-rose-300' },
      { name: '💊 Molecule: Paracetamol (Acetaminophen)', tag: 'Duplicate', color: 'text-amber-300' },
    ],
    suggestedActions: [
      'Stop duplicate brand intake',
      'Ask consulting physician for safe pain alternative',
      'Set Paracetamol daily limit warning',
    ],
  },
  {
    id: 'biomarker-trajectory',
    label: 'Lab Biomarker Velocity',
    icon: <LabFlaskIcon size={14} />,
    badge: 'Biomarker Velocity',
    userPrompt: 'How are my liver enzymes (ALT/SGPT) and kidney markers trending over the past 3 months?',
    aiResponse:
      'Your ALT (SGPT) has decreased from 78 U/L (High) down to 42 U/L (Normal) following lifestyle modifications and medication review (-46.1% improvement).',
    highlightTitle: 'Biomarker Velocity: Normalization Trend',
    highlightDesc:
      'Serum Creatinine remains optimal at 0.9 mg/dL (eGFR > 90 mL/min/1.73m²), showing stable renal filtration alongside your current prescription regimen.',
    highlightType: 'trajectory',
    sources: [
      { name: '🔬 Lab: Chughtai Labs Report', tag: 'July 14 vs Aug 22', color: 'text-teal-300' },
      { name: '📊 Biomarker: ALT / SGPT delta -46%', tag: 'Normalized', color: 'text-emerald-300' },
      { name: '📈 Biomarker: Serum Creatinine 0.9', tag: 'Optimal', color: 'text-cyan-300' },
    ],
    suggestedActions: [
      'Export longitudinal liver biomarker graph',
      'Share report with Gastroenterologist',
      'Set next 3-month lipid & liver panel reminder',
    ],
  },
  {
    id: 'doctor-prep',
    label: 'Doctor Prep Brief',
    icon: <DoctorIcon size={14} />,
    badge: '1-Click Dossier',
    userPrompt: 'Prepare a 1-page consultation brief with high-priority questions for my appointment tomorrow.',
    aiResponse:
      'Dossier generated with 4 active medications, 14-day vitals telemetry (Avg BP 122/78, Fasting Glucose 106 mg/dL), and 3 high-yield consultation questions.',
    highlightTitle: 'High-Priority Consultation Checklist Ready',
    highlightDesc:
      '1. [HIGH] Review ALT normalization and confirm whether Metformin 500mg dose should remain at BD. 2. [MEDIUM] Inquire about Vitamin D3 maintenance dose.',
    highlightType: 'info',
    sources: [
      { name: '📋 Synthesis: Complete Longitudinal File', tag: 'SHA-256 Hashed', color: 'text-purple-300' },
      { name: '🩺 Mode: Human-Verified Records Only', tag: 'Zero Hallucination', color: 'text-teal-300' },
    ],
    suggestedActions: [
      'Print 1-Page Clinical PDF',
      'Generate 6-Digit Secure PIN Share Link',
      'Add consultation notes to timeline',
    ],
  },
];

/* ═══════════════════════════════════════════════
   MAIN LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════ */

export function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ShifaQueryScenario>(SHIFA_SCENARIOS[0] as ShifaQueryScenario);
  const [activeFeatureTab, setActiveFeatureTab] = useState<'sentinel' | 'trajectory' | 'doctor' | 'chronotherapy'>('sentinel');

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
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-teal-600 via-teal-700 to-emerald-600 flex items-center justify-center shadow-md">
              <span className="text-white text-sm font-black">M</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-ink-900">Medfolio</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200/80">
                Shifa AI
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8 text-xs lg:text-sm font-semibold text-ink-600">
            <a href="#shifa-ai" className="hover:text-teal-800 transition-colors flex items-center gap-1">
              <SparklesIcon className="w-3.5 h-3.5 text-teal-600" /> Shifa AI
            </a>
            <a href="#architecture" className="hover:text-teal-800 transition-colors">How It Works</a>
            <a href="#shifa-features" className="hover:text-teal-800 transition-colors">Clinical Suite</a>
            <a href="#comparison" className="hover:text-teal-800 transition-colors">Why Shifa AI</a>
            <a href="#safety-boundaries" className="hover:text-teal-800 transition-colors">Safety & Ethics</a>
            <a href="#vitals" className="hover:text-teal-800 transition-colors">Vitals</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-xs lg:text-sm font-bold text-ink-700 hover:text-teal-900 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4.5 py-2.5 text-xs lg:text-sm font-bold text-white bg-linear-to-r from-teal-700 to-teal-600 rounded-xl hover:from-teal-800 hover:to-teal-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-1.5"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-teal-200" />
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-ink-100 transition-colors"
            aria-label="Toggle navigation menu"
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
            <a
              href="#shifa-ai"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800"
            >
              Shifa AI Co-Pilot
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800"
            >
              How AI Works
            </a>
            <a
              href="#shifa-features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800"
            >
              Clinical Suite
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800"
            >
              Why Shifa AI
            </a>
            <a
              href="#safety-boundaries"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800"
            >
              Safety & Ethics
            </a>
            <a
              href="#vitals"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-ink-700 py-2 hover:text-teal-800"
            >
              Vitals & Reports
            </a>
            <div className="pt-2 border-t border-ink-200/50 flex gap-3">
              <Link to="/login" className="flex-1 text-center px-4 py-2.5 text-sm font-bold rounded-xl border border-ink-200 text-ink-700">
                Sign In
              </Link>
              <Link to="/signup" className="flex-1 text-center px-4 py-2.5 text-sm font-bold rounded-xl bg-teal-700 text-white">
                Get Started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════════════════════
           SECTION 1 — HERO WITH SHIFA AI SPOTLIGHT
         ═══════════════════════════════════════ */}
      <section className="relative min-h-[calc(100vh-1rem)] flex flex-col justify-center items-center px-6 pt-32 pb-20 sm:pt-36 sm:pb-24 overflow-hidden">
        {/* Background Gradient Orbs */}
        <div
          className="absolute top-[-10%] right-[-10%] w-[650px] h-[650px] rounded-full bg-linear-to-br from-teal-300/30 via-emerald-200/20 to-transparent blur-3xl pointer-events-none"
          style={{ transform: `translateY(${scrollY * 0.12}px)` }}
        />
        <div
          className="absolute bottom-[-10%] left-[-15%] w-[550px] h-[550px] rounded-full bg-linear-to-tr from-cyan-200/30 via-blue-100/20 to-transparent blur-3xl pointer-events-none"
          style={{ transform: `translateY(${scrollY * -0.08}px)` }}
        />
        <div
          className="absolute top-[25%] left-[50%] w-[350px] h-[350px] rounded-full bg-linear-to-tr from-teal-100/25 to-emerald-100/15 blur-3xl pointer-events-none"
          style={{ transform: `translate(-50%, ${scrollY * 0.06}px)` }}
        />

        <div className="relative z-10 text-center max-w-4xl mx-auto my-auto flex flex-col items-center">
          {/* Shifa AI Clinical Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-teal-50/90 backdrop-blur-md border border-teal-200/80 mb-6 sm:mb-8 shadow-xs animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping shrink-0" />
            <span className="text-[11px] sm:text-xs font-black text-teal-900 tracking-wider uppercase flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5 text-teal-600" />
              Powered by Shifa AI • Clinical Health Co-Pilot
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-ink-900 leading-[1.08] mb-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            Your Health Records.{' '}
            <br className="hidden sm:block" />
            <span className="bg-linear-to-r from-teal-700 via-teal-600 to-emerald-500 bg-clip-text text-transparent">
              Supercharged by Shifa AI.
            </span>
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-ink-600 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Snap handwritten doctor prescriptions or lab reports. <strong>Shifa AI</strong> ingests your entire health
            data mesh — tracking drug interactions, biomarker velocity, daily vitals, and generating 1-click consultation
            dossiers with zero hallucinations.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-400">
            <Link
              to="/signup"
              className="w-full sm:w-auto group px-8 py-3.5 sm:py-4 text-base font-bold text-white bg-linear-to-r from-teal-700 to-teal-600 rounded-2xl shadow-lg hover:shadow-xl hover:from-teal-800 hover:to-teal-700 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            >
              <SparklesIcon className="w-5 h-5 text-teal-200" />
              Try Shifa AI Free
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#shifa-ai"
              className="w-full sm:w-auto text-center px-8 py-3.5 sm:py-4 text-base font-bold text-ink-700 border border-ink-200 bg-white/70 backdrop-blur-xs rounded-2xl hover:bg-ink-50 transition-all"
            >
              See How Shifa Works
            </a>
          </div>

          {/* Floating Stats Banner */}
          <div className="mt-12 sm:mt-16 p-4 sm:p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-ink-200/70 shadow-sm flex flex-wrap items-center justify-center gap-6 sm:gap-12 animate-in fade-in duration-1000 delay-700">
            <div className="text-center min-w-[90px]">
              <p className="text-2xl sm:text-4xl font-black text-ink-900">
                <AnimatedCounter target={100} suffix="%" />
              </p>
              <p className="text-[10px] sm:text-xs font-bold text-ink-500 uppercase tracking-wider mt-1">
                Record Grounded
              </p>
            </div>
            <div className="w-px h-8 sm:h-10 bg-ink-200" />
            <div className="text-center min-w-[90px]">
              <p className="text-2xl sm:text-4xl font-black text-teal-700">
                <AnimatedCounter target={0} />
              </p>
              <p className="text-[10px] sm:text-xs font-bold text-ink-500 uppercase tracking-wider mt-1">
                Silent Commits
              </p>
            </div>
            <div className="w-px h-8 sm:h-10 bg-ink-200" />
            <div className="text-center min-w-[90px]">
              <p className="text-2xl sm:text-4xl font-black text-ink-900">
                <AnimatedCounter target={256} suffix="-bit" />
              </p>
              <p className="text-[10px] sm:text-xs font-bold text-ink-500 uppercase tracking-wider mt-1">
                AES Privacy Vault
              </p>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="mt-8 text-center animate-bounce">
          <a
            href="#shifa-ai"
            aria-label="Scroll to Shifa AI demo"
            className="inline-block p-1 text-ink-400 hover:text-teal-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </a>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 2 — SHIFA AI LIVE INTERACTIVE CLINICAL TERMINAL
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="shifa-ai" dark className="bg-ink-950 text-white overflow-hidden border-y border-ink-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-black uppercase tracking-[0.2em] mb-4">
              <SparklesIcon className="w-3.5 h-3.5 text-teal-400" />
              Live Clinical Intelligence Engine
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Meet <span className="bg-linear-to-r from-teal-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">Shifa AI</span>
              <br />
              Zero Hallucinations.
              <br />
              100% Record Grounded.
            </h2>
            <p className="text-sm sm:text-base text-ink-300 mt-6 leading-relaxed">
              Unlike generic chatbots that guess medical facts, Shifa AI reads directly from your validated clinical data
              mesh — uniting glucose vitals, blood pressure staging, lab biomarker velocity, prescription schedules, and
              BNF/FDA pharmacopeia registries into one deterministic reasoning stream.
            </p>

            {/* Interactive Query Selectors */}
            <div className="mt-8 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">
                Select a live clinical scenario:
              </p>
              {SHIFA_SCENARIOS.map((scenario) => {
                const isActive = selectedScenario.id === scenario.id;
                return (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-300 flex items-center justify-between ${
                      isActive
                        ? 'bg-teal-950/80 border-teal-400 shadow-lg shadow-teal-950/50'
                        : 'bg-ink-900/60 border-ink-800 hover:border-ink-700 hover:bg-ink-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-teal-500 text-ink-950' : 'bg-ink-800 text-ink-300'
                        }`}
                      >
                        {scenario.icon}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-ink-300'}`}>
                          {scenario.label}
                        </p>
                        <p className="text-[10px] text-ink-400 line-clamp-1">{scenario.userPrompt}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                        isActive
                          ? 'bg-teal-400 text-teal-950'
                          : 'bg-ink-800 text-ink-400'
                      }`}
                    >
                      {scenario.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 text-xs sm:text-sm font-bold text-teal-950 bg-linear-to-r from-teal-400 to-emerald-400 rounded-xl hover:from-teal-300 hover:to-emerald-300 transition-all shadow-lg active:scale-[0.98]"
              >
                Launch Shifa Assistant
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-400">
                <ShieldIcon className="w-4 h-4 text-teal-400" />
                <span>Deterministic RAG</span>
              </div>
            </div>
          </div>

          {/* Interactive Live Terminal Card */}
          <div className="lg:col-span-7 relative">
            <div className="bg-ink-900/90 backdrop-blur-2xl rounded-3xl border border-ink-700/80 shadow-2xl overflow-hidden">
              {/* Header Bar */}
              <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between bg-ink-950/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-linear-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-xs">
                    <SparklesIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white">Shifa AI Co-Pilot</p>
                      <span className="px-1.5 py-0.5 rounded-md bg-teal-500/20 border border-teal-500/30 text-teal-300 font-bold text-[9px] uppercase tracking-wider">
                        {selectedScenario.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-teal-400">Multi-Source Clinical Retrieval</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-ink-300">Live Telemetry</span>
                </div>
              </div>

              {/* Chat Body */}
              <div className="p-5 sm:p-6 space-y-4 min-h-[420px] bg-ink-950/70">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="bg-teal-700 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[380px] shadow-sm">
                    <p className="text-xs text-teal-50 leading-relaxed font-medium">
                      {selectedScenario.userPrompt}
                    </p>
                  </div>
                </div>

                {/* Shifa AI Response */}
                <div className="flex justify-start">
                  <div className="bg-ink-900 rounded-2xl rounded-bl-sm p-4 sm:p-5 max-w-[460px] border border-ink-700 space-y-3 shadow-xl">
                    <p className="text-xs sm:text-sm text-ink-100 leading-relaxed">
                      {selectedScenario.aiResponse}
                    </p>

                    {/* Integrated Clinical Callout Box */}
                    <div
                      className={`p-3 rounded-xl border space-y-1.5 ${
                        selectedScenario.highlightType === 'alert'
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                          : selectedScenario.highlightType === 'trajectory'
                          ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                          : selectedScenario.highlightType === 'info'
                          ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                          : 'bg-teal-950/30 border-teal-500/40 text-teal-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5">
                          <ActivityIcon className="w-3.5 h-3.5" />
                          {selectedScenario.highlightTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-300 leading-relaxed">
                        {selectedScenario.highlightDesc}
                      </p>
                    </div>

                    {/* Grounded Clinical Sources */}
                    <div className="pt-2 border-t border-ink-800 space-y-1.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-ink-400">
                        Verified Clinical Grounding:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedScenario.sources.map((src, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-ink-950 border border-ink-800 text-[10px] text-ink-300 flex items-center gap-1.5"
                          >
                            <span className={src.color}>{src.name}</span>
                            <span className="text-[9px] text-ink-500">({src.tag})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Follow-up Action Chips */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-ink-500">
                    Clinical Action Suggestions:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedScenario.suggestedActions.map((action, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-ink-900 border border-ink-800 text-[10px] font-medium text-ink-300 hover:text-teal-300 hover:border-teal-500/40 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <SparklesIcon className="w-3 h-3 text-teal-400" />
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ambient Background Glow */}
            <div className="absolute -inset-4 bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-emerald-500/10 rounded-[2.5rem] blur-2xl -z-10" />
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 3 — HOW SHIFA AI WORKS (4-STAGE ARCHITECTURE)
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="architecture" className="bg-ink-50/60 border-b border-ink-200/60">
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-3">
            System Architecture
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            How Shifa AI Thinks & Operates
          </h2>
          <p className="text-sm sm:text-base text-ink-600 mt-4 max-w-2xl mx-auto">
            From raw prescription photos to deterministic pharmacopeia safety rules — here is how Shifa AI processes
            your health data without guessing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              stage: '01',
              title: 'Multi-Modal Ingestion',
              subtitle: 'Vision OCR & Document Parser',
              desc: 'High-fidelity transcription of handwritten Pakistani doctor slips, lab reports, and home monitors. Every field is given a confidence score.',
              badge: 'Confidence Scored',
              color: 'from-teal-600 to-teal-700',
              icon: <CameraIcon className="w-6 h-6 text-white" />,
            },
            {
              stage: '02',
              title: 'Clinical Data Mesh',
              subtitle: 'Deterministic Multi-Source RAG',
              desc: 'Cross-connects 13 structured clinical tables: active medications, 30-day vitals trends, historical biomarker velocity, and doctor notes.',
              badge: '13 Tables Indexed',
              color: 'from-blue-600 to-blue-700',
              icon: <BrainIcon className="w-6 h-6 text-white" />,
            },
            {
              stage: '03',
              title: 'Sentinel Safety Engine',
              subtitle: 'Pharmacopeia & Overdose Math',
              desc: 'Cross-checks BNF & FDA registries to catch duplicate generic molecules across brand names (e.g. Panadol + Calpol) and computes daily mg loads.',
              badge: 'Toxicity Detection',
              color: 'from-amber-600 to-amber-700',
              icon: <ShieldIcon className="w-6 h-6 text-white" />,
            },
            {
              stage: '04',
              title: 'Physician Action Suite',
              subtitle: 'Consultation Briefs & Chronotherapy',
              desc: 'Generates 1-click consultation dossiers, smart doctor question priority checklists, and meal-aligned morning/afternoon/evening dose buckets.',
              badge: '1-Click Export',
              color: 'from-emerald-600 to-emerald-700',
              icon: <DoctorIcon className="w-6 h-6 text-white" />,
            },
          ].map((item, idx) => (
            <Reveal
              key={item.stage}
              delayMs={idx * 120}
              distance={8}
              className="relative p-7 rounded-3xl bg-white border border-ink-200/70 shadow-xs hover:shadow-xl hover:border-teal-500/40 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-linear-to-br ${item.color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                  >
                    {item.icon}
                  </div>
                  <span className="text-xl font-black text-ink-300 font-mono">
                    {item.stage}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-ink-100 text-ink-700">
                  {item.badge}
                </span>
                <h3 className="text-base font-bold text-ink-900 mt-3 mb-1">{item.title}</h3>
                <p className="text-xs font-semibold text-teal-700 mb-2">{item.subtitle}</p>
                <p className="text-xs text-ink-600 leading-relaxed">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 4 — SHIFA AI CLINICAL SUITE (INTERACTIVE FEATURE TABS)
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="shifa-features">
        <div className="text-center mb-12">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-3">
            Core AI Capabilities
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            The Shifa AI Clinical Intelligence Suite
          </h2>
          <p className="text-sm sm:text-base text-ink-600 mt-4 max-w-2xl mx-auto">
            Explore the four major clinical modules that power Medfolio's intelligent patient co-pilot.
          </p>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="flex items-center justify-center mb-10 overflow-x-auto scrollbar-none pb-2">
          <div className="p-1.5 rounded-2xl bg-ink-100/80 border border-ink-200/80 flex items-center gap-1 shadow-inner">
            {[
              { id: 'sentinel', label: 'Sentinel Safety Radar', icon: <ShieldIcon size={14} /> },
              { id: 'trajectory', label: 'Biomarker Velocity', icon: <LabFlaskIcon size={14} /> },
              { id: 'doctor', label: 'Doctor Prep Brief', icon: <DoctorIcon size={14} /> },
              { id: 'chronotherapy', label: 'Chronotherapy & Timing', icon: <ClockIcon size={14} /> },
            ].map((tab) => {
              const active = activeFeatureTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureTab(tab.id as typeof activeFeatureTab)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    active
                      ? 'bg-white text-ink-900 shadow-sm border border-ink-200/70'
                      : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Feature Tab Content Display */}
        <div className="p-6 sm:p-10 rounded-3xl bg-linear-to-br from-ink-50/70 via-white to-teal-50/30 border border-ink-200/70 shadow-sm">
          {activeFeatureTab === 'sentinel' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-black uppercase tracking-wider">
                  <AlertTriangleIcon size={12} /> Pharmacopeia Sentinel Engine
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-ink-900">
                  Catch Duplicate Generics & Cumulative Overdoses
                </h3>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                  In Pakistan, patients frequently take <em>Panadol</em> alongside <em>Calpol</em> or <em>Disprol</em>,
                  unaware they all share the identical molecule (Paracetamol). Shifa's Sentinel Engine breaks down every
                  brand into its underlying generic chemical entity, calculating total daily milligram load against
                  clinical safety ceilings.
                </p>
                <ul className="space-y-2.5 text-xs text-ink-700">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Real-time cross-referencing against BNF and FDA pharmacopeia</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Calculates cumulative daily toxicity limits (e.g. 4,000mg Paracetamol threshold)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Flags dangerous drug-drug combinations (e.g. Warfarin + NSAIDs)</span>
                  </li>
                </ul>
              </div>

              {/* Mock Sentinel Radar Card */}
              <div className="lg:col-span-6">
                <div className="p-6 rounded-3xl bg-white border border-rose-200/80 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-ink-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                        <AlertTriangleIcon size={16} />
                      </span>
                      <h4 className="text-xs font-bold text-ink-900">Sentinel Active Radar</h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase">
                      Duplicate Generic Alert
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                      <span>Molecules Involved:</span>
                      <span className="font-mono">Paracetamol 500mg</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      Active prescriptions contain both <strong>Panadol 500mg (BD)</strong> and{' '}
                      <strong>Calpol 250mg/5ml</strong>. Combined daily dose reaches{' '}
                      <span className="font-bold text-rose-950">2,500 mg</span> (Max safe limit: 4,000 mg/day).
                    </p>
                    <div className="w-full bg-rose-200/80 rounded-full h-2 mt-2">
                      <div className="bg-rose-600 h-2 rounded-full" style={{ width: '62.5%' }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-rose-700 font-mono">
                      <span>Current: 2,500mg</span>
                      <span>Safe Limit: 4,000mg</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-ink-50 border border-ink-200/70 text-xs text-ink-700">
                    <p className="font-bold text-ink-900 mb-1">Clinical Action Recommendation:</p>
                    <p className="text-[11px] text-ink-600">
                      Discontinue overlapping brand immediately and consult prescribing physician before adding further
                      fever or pain relievers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'trajectory' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                  <LabFlaskIcon size={12} /> Longitudinal Velocity Engine
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-ink-900">
                  Track Biomarker Velocity & Reference Shifts
                </h3>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                  A single lab report only shows a single moment in time. Shifa AI extracts tests from multiple historical
                  reports to calculate the <strong>rate of change (delta %)</strong> for HbA1c, ALT, Creatinine, and
                  Cholesterol, matching them with clinical standard intervals.
                </p>
                <ul className="space-y-2.5 text-xs text-ink-700">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Automatic conversion between SI (mmol/L) and US conventional units (mg/dL)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Trend classification: Improving, Worsening, Stable, or Fluctuating</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Integrates seamlessly with medication adherence timelines</span>
                  </li>
                </ul>
              </div>

              {/* Mock Biomarker Trajectory Card */}
              <div className="lg:col-span-6">
                <div className="p-6 rounded-3xl bg-white border border-blue-200/80 shadow-lg space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-ink-100">
                    <div>
                      <h4 className="text-xs font-bold text-ink-900">ALT / SGPT (Liver Enzyme)</h4>
                      <p className="text-[10px] text-ink-500">Ref: 7.00 – 56.00 U/L</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                      Improving (-46.1%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-200">
                      <p className="text-[10px] text-rose-700 font-bold uppercase">Jul 14 (Previous)</p>
                      <p className="text-xl font-black text-rose-950">78 <span className="text-xs font-normal">U/L</span></p>
                      <span className="text-[9px] font-bold text-rose-800">Elevated</span>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                      <p className="text-[10px] text-emerald-700 font-bold uppercase">Aug 22 (Latest)</p>
                      <p className="text-xl font-black text-emerald-950">42 <span className="text-xs font-normal">U/L</span></p>
                      <span className="text-[9px] font-bold text-emerald-800">Normal Range</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200/70 text-xs text-teal-900">
                    <p className="font-bold mb-0.5">Clinical Significance:</p>
                    <p className="text-[11px] text-teal-800">
                      Liver transaminases normalized following 4 weeks of prescribed regimen adherence and lifestyle
                      interventions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'doctor' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-black uppercase tracking-wider">
                  <DoctorIcon size={12} /> Doctor Visit Co-Pilot
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-ink-900">
                  1-Click Consultation Brief & High-Priority Questions
                </h3>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                  Patients often forget their questions in short 5-minute doctor appointments. Shifa AI synthesizes your
                  recent blood pressure readings, glucose logs, active medicines, and lab anomalies into a structured
                  consultation brief with prioritized questions.
                </p>
                <ul className="space-y-2.5 text-xs text-ink-700">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Categorized questions: [HIGH], [MEDIUM], and [ROUTINE] priority</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Printable 1-page clinical dossier for your doctor to review in 30 seconds</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>SHA-256 tamper-evident digital watermark for second-opinion consultations</span>
                  </li>
                </ul>
              </div>

              {/* Mock Doctor Brief Card */}
              <div className="lg:col-span-6">
                <div className="p-6 rounded-3xl bg-white border border-purple-200/80 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-ink-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
                        <QuestionIcon size={16} />
                      </span>
                      <h4 className="text-xs font-bold text-ink-900">Consultation Priority Questions</h4>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold">Generated from Records</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[9px]">HIGH PRIORITY</span>
                        <span className="text-[10px] text-ink-500">Lab Inquiries</span>
                      </div>
                      <p className="font-semibold text-ink-900">
                        My ALT improved to 42 U/L. Should I continue Metformin 500mg at current dosage?
                      </p>
                    </div>

                    <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">MEDIUM PRIORITY</span>
                        <span className="text-[10px] text-ink-500">Long-term Regimen</span>
                      </div>
                      <p className="font-semibold text-ink-900">
                        Are routine kidney function tests recommended before next refill?
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeFeatureTab === 'chronotherapy' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black uppercase tracking-wider">
                  <ClockIcon size={12} /> Chronotherapy Schedule Engine
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-ink-900">
                  Smart Dose Buckets with Meal Relations
                </h3>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed">
                  Taking medicines at the wrong time of day or without appropriate food relations reduces efficacy and
                  provokes side effects. Shifa AI translates medical sigs (OD, BD, TDS, HS, AC, PC) into 4 intuitive day
                  slots: Morning, Afternoon, Evening, and Night.
                </p>
                <ul className="space-y-2.5 text-xs text-ink-700">
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Deterministic frequency parsing (`1-0-1`, `TDS`, `HS`, `x5/7`)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Meal-relation reminders: Before meals, with food, or after dinner</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>One-tap mark-as-taken with reason tracking for missed doses</span>
                  </li>
                </ul>
              </div>

              {/* Mock Chronotherapy Card */}
              <div className="lg:col-span-6">
                <div className="p-6 rounded-3xl bg-white border border-emerald-200/80 shadow-lg space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-ink-100">
                    <h4 className="text-xs font-bold text-ink-900">Today's Dose Timeline</h4>
                    <span className="text-[10px] text-teal-700 font-bold">Auto-Scheduled</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                        <MealIcon size={14} /> Morning (08:00 AM)
                      </div>
                      <p className="text-xs font-bold text-ink-900">Metformin 500mg</p>
                      <p className="text-[10px] text-amber-800 mt-0.5">With breakfast</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-1">
                        <ClockIcon size={14} /> Night (10:00 PM)
                      </div>
                      <p className="text-xs font-bold text-ink-900">Rosuvastatin 10mg</p>
                      <p className="text-[10px] text-indigo-800 mt-0.5">Before bedtime</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 5 — SHIFA AI VS GENERIC LLMs (COMPARISON MATRIX)
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="comparison" dark className="bg-ink-950 text-white overflow-hidden border-y border-ink-800">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-black uppercase tracking-[0.2em] mb-4">
            <ZapIcon className="w-3.5 h-3.5 text-teal-400" />
            Clinical Grounding vs. Generic AI
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Why Generic AI Fails in Healthcare
          </h2>
          <p className="text-sm sm:text-base text-ink-300 mt-4 max-w-2xl mx-auto">
            Generic chatbots hallucinate medical dosages, invent diagnoses, and lack your historical health records.
            Shifa AI is purpose-built for clinical safety.
          </p>
        </div>

        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-ink-400">
                <th className="py-4 px-4 font-bold uppercase text-[10px] tracking-wider">Capability</th>
                <th className="py-4 px-4 font-bold uppercase text-[10px] tracking-wider text-rose-400">Generic Chatbots</th>
                <th className="py-4 px-4 font-bold uppercase text-[10px] tracking-wider text-teal-400 bg-teal-950/40 rounded-t-xl">
                  Shifa AI on Medfolio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/60">
              {[
                {
                  cap: 'Record Grounding',
                  generic: 'Zero personal context; guesses based on generic text prompts',
                  shifa: 'Multi-source RAG synthesizing 13 clinical tables & 30-day telemetry',
                },
                {
                  cap: 'Pharmacopeia Safety',
                  generic: 'Cannot detect duplicate brand names or compute cumulative toxicity',
                  shifa: 'Sentinel Molecule Registry identifies brand duplication & overdose ceilings',
                },
                {
                  cap: 'Dosage Arithmetic',
                  generic: 'Prone to mathematical hallucinations and wrong frequency counts',
                  shifa: 'Deterministic domain rules parse exact frequencies & durations',
                },
                {
                  cap: 'Data Commits',
                  generic: 'Blindly adds unverified guesses without human confirmation',
                  shifa: 'Zero silent commits — patient reviews every extracted field',
                },
                {
                  cap: 'Doctor Readiness',
                  generic: 'Vague text advice that doctors dismiss',
                  shifa: '1-click structured clinical dossiers with prioritized consultation questions',
                },
                {
                  cap: 'Privacy & Security',
                  generic: 'Prompts often stored and used for model retraining',
                  shifa: '256-bit AES encryption, tenant RLS isolation, never trained on patient data',
                },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-ink-900/40 transition-colors">
                  <td className="py-4 px-4 font-bold text-white whitespace-nowrap">{row.cap}</td>
                  <td className="py-4 px-4 text-ink-400">{row.generic}</td>
                  <td className="py-4 px-4 font-semibold text-teal-300 bg-teal-950/20">{row.shifa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 6 — CLINICAL SAFETY & AI BOUNDARIES (NOT A DOCTOR)
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="safety-boundaries" dark className="bg-ink-950 text-white overflow-hidden">
        <div className="relative">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-black uppercase tracking-[0.2em] mb-6">
              <ShieldIcon className="w-4 h-4 text-teal-400" />
              Clinical Safety & AI Boundaries
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
              Assisting your care,{' '}
              <span className="bg-linear-to-r from-teal-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                never replacing your doctor
              </span>
            </h2>
            <p className="text-sm sm:text-base text-ink-300 mt-6 leading-relaxed">
              Medfolio is a clinical organizer and patient assistance platform. We empower patients and doctors with
              organized, verified data — we are <strong>not a diagnostic agent</strong> and do not prescribe treatments.
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

                <ul className="space-y-4 text-xs sm:text-sm text-ink-300">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <span>
                      <strong>Accurate OCR Extraction:</strong> Transcribes doctor handwriting and lab reports with high
                      fidelity for your confirmation.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <span>
                      <strong>Adherence & Timings:</strong> Schedules doses into morning, afternoon, evening, and night
                      buckets with meal relations.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-2 shrink-0" />
                    <span>
                      <strong>Doctor Visit Readiness:</strong> Generates clean 1-page clinical dossiers so physicians
                      have full longitudinal context.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Safety Guardrail Highlight */}
              <div className="mt-8 pt-6 border-t border-ink-800">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 block mb-1">
                  STRICT MEDICAL DISCLAIMER
                </span>
                <p className="text-xs text-ink-200 font-medium leading-relaxed">
                  Medfolio is an assistive tool. Always consult a certified healthcare professional before making
                  medical decisions or modifying medications.
                </p>
              </div>
            </div>

            {/* Right Card: Human-in-the-Loop Workflow */}
            <div className="lg:col-span-7 flex flex-col justify-between p-8 rounded-3xl bg-ink-900/90 border border-ink-800 backdrop-blur-xl shadow-2xl">
              <div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-400 block mb-6">
                  HUMAN-IN-THE-LOOP SAFEGUARDS
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-ink-950/80 border border-ink-800 flex items-start gap-3.5 hover:border-teal-500/40 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                      <UserIcon className="w-5 h-5 text-cyan-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">1. Patient Input</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Capture prescription slip, upload lab report, or log daily vitals
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-ink-950/80 border border-teal-500/30 flex items-start gap-3.5 hover:border-teal-400 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
                      <SparklesIcon className="w-5 h-5 text-teal-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-300">2. Shifa AI Assistance</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Grounded text extraction, interaction radar & reference range analysis
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-linear-to-br from-ink-950 to-teal-950/40 border border-teal-500/50 flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/50 flex items-center justify-center text-teal-200 shrink-0">
                      <ShieldIcon className="w-5 h-5 text-teal-200" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">3. Human Review</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Zero silent commits: you review every field before saving to your profile
                      </p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-ink-950/80 border border-emerald-500/30 flex items-start gap-3.5 hover:border-emerald-400 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                      <CheckCircleIcon className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-300">4. Doctor Collaboration</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        Share tamper-evident records and dossiers directly with consulting physicians
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-ink-800/80 flex items-center justify-between text-xs text-ink-400">
                <span className="flex items-center gap-1.5">
                  <LockIcon className="w-3.5 h-3.5 text-teal-400" /> Zero silent commits • 100% Verified Records
                </span>
                <span className="text-teal-400 font-semibold">13 Clinical Tables</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 7 — CLINICAL VITALS RADAR
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="vitals">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
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
                <p className="text-2xl font-black text-teal-950">
                  92 <span className="text-xs font-normal text-teal-700">mg/dL</span>
                </p>
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
                <p className="text-2xl font-black text-blue-950">
                  118/78 <span className="text-xs font-normal text-blue-700">mmHg</span>
                </p>
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
              Clinical vitals tracking
              <br />
              <span className="bg-linear-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent">
                with automatic staging
              </span>
            </h2>
            <p className="text-base text-ink-600 mt-6 leading-relaxed">
              Log fasting, post-meal, random, and bedtime blood sugar readings. Track systolic, diastolic, pulse, arm,
              and posture for every blood pressure check. Every entry is instantly evaluated against ADA and AHA
              clinical standards.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  icon: <TargetIcon className="w-5 h-5 text-teal-600" />,
                  title: 'ADA Glycemic Targets',
                  desc: 'Fasting, post-prandial, and random glucose evaluated in real time',
                },
                {
                  icon: <StethoscopeIcon className="w-5 h-5 text-blue-600" />,
                  title: 'AHA Blood Pressure Stages',
                  desc: 'Normal, Elevated, Stage 1, Stage 2, and Hypertensive evaluation',
                },
                {
                  icon: <BarChartIcon className="w-5 h-5 text-purple-600" />,
                  title: 'Mean Arterial Pressure',
                  desc: 'MAP computed automatically for organ perfusion insight',
                },
                {
                  icon: <ZapIcon className="w-5 h-5 text-amber-600" />,
                  title: 'Spike & Dip Detection',
                  desc: 'Alerts when velocity changes exceed safe clinical thresholds',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-ink-50 border border-ink-100 shrink-0 mt-0.5">{item.icon}</div>
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

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 8 — ALL CORE PLATFORM FEATURES GRID
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="features" className="bg-ink-50/50">
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700 mb-3">
            Full Health Platform
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-900 tracking-tight">
            Everything your health record should be
          </h2>
          <p className="text-base text-ink-600 mt-4 max-w-2xl mx-auto">
            Engineered with clinical precision to support your day-to-day healthcare journey.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon={<CameraIcon className="w-6 h-6 text-teal-600" />}
            title="Snap & Extract Prescriptions"
            desc="Photograph handwritten doctor slips. Medicine names, dosages, frequencies, and durations are extracted in seconds for your verification."
            tag="Vision AI"
            gradient="bg-linear-to-br from-teal-50/50 to-emerald-50/30"
            delay={0}
          />
          <FeatureCard
            icon={<LabFlaskIcon className="w-6 h-6 text-blue-600" />}
            title="Lab Report Intelligence"
            desc="Upload lab reports and instantly see out-of-range biomarkers with visual flagging, reference intervals, and historical trajectory graphs."
            tag="Biomarker RAG"
            gradient="bg-linear-to-br from-blue-50/50 to-indigo-50/30"
            delay={100}
          />
          <FeatureCard
            icon={<MedicineIcon className="w-6 h-6 text-amber-600" />}
            title="Chronotherapy Schedule"
            desc="Auto-generated dose timeline with morning, afternoon, evening, and night buckets. Meal relation guidance with one-tap compliance."
            tag="Dose Engine"
            gradient="bg-linear-to-br from-amber-50/50 to-orange-50/30"
            delay={200}
          />
          <FeatureCard
            icon={<ClockIcon className="w-6 h-6 text-purple-600" />}
            title="Longitudinal Timeline"
            desc="A living chronological record of every doctor visit, prescription change, lab investigation, and vitals milestone."
            tag="Complete History"
            gradient="bg-linear-to-br from-purple-50/50 to-violet-50/30"
            delay={300}
          />
          <FeatureCard
            icon={<ReceiptIcon className="w-6 h-6 text-emerald-600" />}
            title="Medical Expense Tracker"
            desc="Track every rupee spent on consultations, pharmacy medicines, and lab tests. Visual monthly breakdown with category totals."
            tag="Finance OS"
            gradient="bg-linear-to-br from-emerald-50/50 to-green-50/30"
            delay={400}
          />
          <FeatureCard
            icon={<LinkIcon className="w-6 h-6 text-indigo-600" />}
            title="Secure PIN & QR Shares"
            desc="Generate time-limited access links with 6-digit PINs or scannable QR codes. Automatic self-destruction after your set duration."
            tag="SHA-256 Verified"
            gradient="bg-linear-to-br from-indigo-50/50 to-blue-50/30"
            delay={500}
          />
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 9 — SECURITY & PRIVACY VAULT
         ═══════════════════════════════════════════════════════════════ */}
      <Section id="security" dark>
        <div className="text-center mb-16">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-400 mb-3">
            Zero-Compromise Security
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Medical-Grade Data Protection
          </h2>
          <p className="text-base text-ink-400 mt-4 max-w-2xl mx-auto">
            Your health data is the most sensitive information you own. We protect it with banking-grade security.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: <LockIcon className="w-6 h-6 text-teal-400" />,
              title: 'Row-Level Security',
              desc: 'Every database query is tenant-isolated. Users can strictly access only their own records.',
            },
            {
              icon: <ShieldIcon className="w-6 h-6 text-emerald-400" />,
              title: 'SHA-256 Watermarking',
              desc: 'Exported medical records carry tamper-evident cryptographic verification hashes.',
            },
            {
              icon: <ClockIcon className="w-6 h-6 text-indigo-400" />,
              title: 'Self-Destructing Shares',
              desc: 'Time-limited access links that auto-expire and can be instantly revoked anytime.',
            },
            {
              icon: <WifiIcon className="w-6 h-6 text-amber-400" />,
              title: 'Offline Vault',
              desc: 'Full offline capability with local encrypted caching when connectivity drops.',
            },
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

      {/* ═══════════════════════════════════════════════════════════════
           SECTION 10 — FINAL CTA
         ═══════════════════════════════════════════════════════════════ */}
      <section className="relative px-6 py-32 sm:py-40 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-teal-950 via-teal-900 to-emerald-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]" />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 text-xs font-black uppercase tracking-wider mb-6">
            <SparklesIcon className="w-4 h-4 text-teal-300" />
            Get Started with Shifa AI Today
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Your health story
            <br />
            deserves better than
            <br />
            <span className="bg-linear-to-r from-teal-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">
              a shoebox of papers
            </span>
          </h2>
          <p className="text-base sm:text-lg text-teal-100/80 mt-6 max-w-xl mx-auto leading-relaxed">
            Start organizing your prescriptions, tracking your biomarker trajectories, and walking into every doctor visit
            with a complete clinical picture.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              to="/signup"
              className="group px-10 py-4 text-base font-bold text-teal-950 bg-white rounded-2xl shadow-lg hover:shadow-xl hover:bg-teal-50 transition-all active:scale-[0.97] flex items-center gap-2"
            >
              <SparklesIcon className="w-5 h-5 text-teal-700" />
              Create Your Free Account
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <p className="text-xs text-teal-200/60 mt-8">
            No credit card required · Free forever for personal use · Zero silent data commits
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
           FOOTER
         ═══════════════════════════════════════════════════════════════ */}
      <footer className="bg-ink-950 border-t border-ink-800 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-linear-to-br from-teal-600 to-emerald-500 flex items-center justify-center">
              <span className="text-white text-xs font-black">M</span>
            </div>
            <span className="text-sm font-bold text-ink-300">Medfolio Health OS with Shifa AI</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-ink-400">
            <a href="#shifa-ai" className="hover:text-teal-400 transition-colors">Shifa AI</a>
            <a href="#architecture" className="hover:text-teal-400 transition-colors">Architecture</a>
            <a href="#shifa-features" className="hover:text-teal-400 transition-colors">Clinical Suite</a>
            <a href="#comparison" className="hover:text-teal-400 transition-colors">Why Shifa AI</a>
            <a href="#safety-boundaries" className="hover:text-teal-400 transition-colors">Safety</a>
            <Link to="/login" className="hover:text-teal-400 transition-colors">Sign In</Link>
          </div>

          <p className="text-xs text-ink-500">
            © {new Date().getFullYear()} Medfolio. Built with clinical precision.
          </p>
        </div>
      </footer>
    </div>
  );
}
