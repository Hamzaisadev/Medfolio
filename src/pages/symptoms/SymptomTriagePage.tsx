import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Toast } from '../../components/ui/Toast';
import { Disclaimer } from '../../components/ui/Disclaimer';
import {
  EmergencyAmbulanceIcon,
  AlertTriangleIcon,
  PhoneIcon,
  CheckIcon,
  CopyIcon,
  TrashIcon,
  MedicineIcon,
  SparklesIcon,
  FolderIcon,
  StethoscopeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '../../components/ui/icons';
import { checkRedFlags, EMERGENCY_HELPLINES } from '../../domain/redFlags';
import { sideEffectsRepo, medicinesRepo, profilesRepo } from '../../lib/db';
import { activeMedicines, type MedicineRecord } from '../../domain/activeMedicines';
import { todayInAppTz } from '../../lib/time';
import { SYMPTOM_DISCLAIMER } from '../../lib/disclaimer';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Tables } from '../../lib/supabase/types';

export interface SymptomEvent {
  id: string;
  timeLabel: string;
  timestamp: string;
  symptomName: string;
  severity: 'mild' | 'moderate' | 'severe';
  note?: string;
  bodyLocation?: string;
}

const COMMON_SYMPTOM_CHIPS = [
  { name: 'Headache', defaultSeverity: 'mild' as const, time: 'Morning (08:00 AM)' },
  { name: 'Fever', defaultSeverity: 'moderate' as const, time: 'Afternoon (01:30 PM)' },
  { name: 'Nausea / Upset Stomach', defaultSeverity: 'moderate' as const, time: 'Evening (06:00 PM)' },
  { name: 'Dizziness', defaultSeverity: 'mild' as const, time: 'Afternoon (01:30 PM)' },
  { name: 'Cough / Sore Throat', defaultSeverity: 'mild' as const, time: 'Morning (08:00 AM)' },
  { name: 'Body Aches', defaultSeverity: 'mild' as const, time: 'Morning (08:00 AM)' },
  { name: 'Fatigue / Tiredness', defaultSeverity: 'mild' as const, time: 'Afternoon (01:30 PM)' },
  { name: 'Shortness of Breath', defaultSeverity: 'severe' as const, time: 'Just now' },
  { name: 'Chest Tightness', defaultSeverity: 'severe' as const, time: 'Just now' },
  { name: 'Skin Rash / Itch', defaultSeverity: 'mild' as const, time: 'Morning (08:00 AM)' },
];

const TIME_OPTIONS = [
  'Just now',
  'Morning (08:00 AM)',
  'Afternoon (01:30 PM)',
  'Evening (06:00 PM)',
  'Night / Bedtime (10:00 PM)',
  'Yesterday',
  '2 days ago',
];

export function SymptomTriagePage() {
  const navigate = useNavigate();
  const { user, profile: authProfile } = useAuth();

  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Flow State: 'input' (Step 1: Check In) vs 'summary' (Step 2: Results & Guidance)
  const [currentStep, setCurrentStep] = useState<'input' | 'summary'>('input');
  const [showTimelineHistory, setShowTimelineHistory] = useState(false);
  const [showHelplines, setShowHelplines] = useState(false);

  // Chronological Symptom Events Timeline State
  const [events, setEvents] = useState<SymptomEvent[]>([]);

  // Form state for adding new events
  const [symptomInput, setSymptomInput] = useState('');
  const [timeLabel, setTimeLabel] = useState('Just now');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [note, setNote] = useState('');

  const today = todayInAppTz();
  const effectiveUserId = user?.id || authProfile?.user_id || '';
  const effectiveProfileId = authProfile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const [p, mList] = await Promise.all([
        profilesRepo.getDefaultProfile(effectiveUserId),
        medicinesRepo.listMedicines(effectiveProfileId),
      ]);
      setProfile(p);
      setMedicines(mList);
    } catch (err) {
      console.error('Failed to load patient records for triage:', err);
    }
  }, [effectiveUserId, effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeMedsList: MedicineRecord[] = activeMedicines(medicines, today);

  // Combined symptom text for evaluation
  const combinedSymptomText = useMemo(() => {
    if (events.length === 0 && symptomInput.trim()) {
      return `${timeLabel}: ${symptomInput} (${severity}) - ${note}`;
    }
    return events.map((e) => `${e.timeLabel}: ${e.symptomName} (${e.severity}) - ${e.note || ''}`).join('\n');
  }, [events, symptomInput, severity, timeLabel, note]);

  // Offline Zero-Network Emergency Red Flag Detection
  const redFlagResult = useMemo(() => {
    return checkRedFlags(combinedSymptomText);
  }, [combinedSymptomText]);

  // Active Medication Correlation Analysis
  const medicationCorrelations = useMemo(() => {
    if ((events.length === 0 && !symptomInput.trim()) || activeMedsList.length === 0) return [];
    const textLower = combinedSymptomText.toLowerCase();
    const correlations: Array<{ medName: string; suspectedLink: string; confidence: 'High' | 'Possible' }> = [];

    activeMedsList.forEach((med) => {
      const nameLower = med.medicine_name.toLowerCase();

      // Calcium Channel Blockers (Amlodipine) -> Swollen ankles / Edema / Dizziness
      if (
        (nameLower.includes('amlo') || nameLower.includes('norvasc')) &&
        (textLower.includes('swelling') || textLower.includes('ankle') || textLower.includes('foot') || textLower.includes('edema') || textLower.includes('dizzy'))
      ) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Known side effect: Ankle swelling or mild dizziness can occur with blood pressure medications like Amlodipine.',
          confidence: 'High',
        });
      }

      // Metformin -> GI upset / Nausea / Diarrhea / Stomach pain
      if (
        (nameLower.includes('metformin') || nameLower.includes('glucophage')) &&
        (textLower.includes('nausea') || textLower.includes('vomit') || textLower.includes('stomach') || textLower.includes('diarrhea') || textLower.includes('cramp') || textLower.includes('loose') || textLower.includes('upset'))
      ) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Stomach upset or nausea is common with Metformin, especially if taken on an empty stomach. Taking it with a main meal usually helps.',
          confidence: 'High',
        });
      }

      // ACE Inhibitors (Lisinopril / Enalapril / Ramipril) -> Dry Cough
      if (
        (nameLower.includes('pril') || nameLower.includes('zestril') || nameLower.includes('tritace')) &&
        (textLower.includes('cough') || textLower.includes('khansi') || textLower.includes('throat'))
      ) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'A persistent dry cough is a known reaction to ACE inhibitors. If it continues, your doctor can easily switch you to an alternative medication.',
          confidence: 'High',
        });
      }

      // Statins (Atorvastatin / Rosuvastatin) -> Muscle pain / Myalgia
      if (
        (nameLower.includes('statin') || nameLower.includes('lipiget') || nameLower.includes('lipitor') || nameLower.includes('rovista')) &&
        (textLower.includes('muscle') || textLower.includes('ache') || textLower.includes('cramp') || textLower.includes('joint') || textLower.includes('dard'))
      ) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Muscle aches can sometimes be linked to cholesterol medications (statins). Mention this to your doctor if the soreness persists.',
          confidence: 'Possible',
        });
      }

      // Antibiotics (Augmentin, Cipro) -> Loose stools / Rash
      if (
        (nameLower.includes('augmentin') || nameLower.includes('amoxi') || nameLower.includes('cipro')) &&
        (textLower.includes('diarrhea') || textLower.includes('rash') || textLower.includes('itching'))
      ) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Antibiotics can temporarily disrupt stomach digestion or cause skin sensitivity.',
          confidence: 'High',
        });
      }
    });

    return correlations;
  }, [events, activeMedsList, combinedSymptomText, symptomInput]);

  // Dynamic Patient-Friendly Health Assessment
  const triageAssessment = useMemo(() => {
    if (events.length === 0 && !symptomInput.trim()) {
      return {
        level: 'green' as const,
        badgeLabel: 'Healthy & Normal',
        headline: 'No symptoms logged yet',
        summary: 'Enter what you are feeling to see personalized health guidance and comfort tips.',
        homeCare: ['Stay hydrated with plenty of water', 'Maintain your regular routine and rest'],
        nextRedFlags: ['Sudden severe chest pain', 'Difficulty breathing', 'Confusion or fainting'],
        specialist: 'General Physician / Family Doctor',
      };
    }

    if (redFlagResult.isEmergency) {
      return {
        level: 'red' as const,
        badgeLabel: 'Urgent Attention Needed',
        headline: 'Please seek medical care immediately',
        summary: `Your symptoms match urgent warning signs (${redFlagResult.matchedLabels.join(', ')}). Please visit the nearest emergency room or call for an ambulance without delay.`,
        homeCare: ['Rest quietly in a comfortable position', 'Do not attempt to drive yourself to the clinic', 'Have someone stay with you'],
        nextRedFlags: ['Loss of consciousness', 'Difficulty speaking or catching your breath', 'Severe worsening pain'],
        specialist: 'Emergency Room / Urgent Care Clinic',
      };
    }

    const currentEvents = events.length > 0 ? events : [{ symptomName: symptomInput, severity, timeLabel, id: 'temp', timestamp: new Date().toISOString() }];
    const hasSevere = currentEvents.some((e) => e.severity === 'severe');
    const hasModerate = currentEvents.some((e) => e.severity === 'moderate');
    const count = currentEvents.length;

    const textLower = combinedSymptomText.toLowerCase();
    const hasFever = textLower.includes('fever') || textLower.includes('101') || textLower.includes('102') || textLower.includes('bukhar');
    const hasVomit = textLower.includes('vomit') || textLower.includes('nausea') || textLower.includes('loose') || textLower.includes('diarrhea') || textLower.includes('upset');
    const hasHeadache = textLower.includes('headache') || textLower.includes('sar dard') || textLower.includes('migraine');
    const hasRespiratory = textLower.includes('cough') || textLower.includes('breath') || textLower.includes('throat');

    if (hasSevere || (hasFever && hasVomit) || (hasFever && hasHeadache && count >= 2) || (hasModerate && count >= 2) || count >= 3) {
      return {
        level: 'amber' as const,
        badgeLabel: 'Doctor Visit Recommended',
        headline: 'Consider seeing a doctor in the next 24–48 hours',
        summary: `You have logged ${count > 1 ? `${count} symptoms` : 'a moderate/strong symptom'}. While not an emergency, having a doctor examine you will help ensure you recover quickly and safely.`,
        homeCare: [
          'Hydration: Drink plenty of clean water, clear broths, or ORS in small sips.',
          'Rest: Avoid heavy physical activity and get extra sleep.',
          'Fever / Pain: Paracetamol (Panadol) with food if recommended by your doctor.',
        ],
        nextRedFlags: [
          'Inability to keep liquids down for more than 12 hours',
          'High fever rising above 102°F that doesn’t come down with medication',
          'Sudden confusion, stiff neck, or extreme weakness',
        ],
        specialist: hasVomit ? 'Gastroenterologist or General Physician' : hasRespiratory ? 'Pulmonologist or ENT Specialist' : 'Family Physician / General Doctor',
      };
    }

    return {
      level: 'green' as const,
      badgeLabel: 'Mild — Home Care & Rest',
      headline: 'Your symptoms look mild and manageable',
      summary: 'With good rest, hydration, and observation, mild symptoms usually improve over the next 1–2 days.',
      homeCare: [
        'Drink 8–10 glasses of water throughout the day.',
        'Get at least 7–8 hours of sound, restful sleep.',
        'Take a break from screens and strenuous physical work.',
      ],
      nextRedFlags: ['Sudden spike in high fever', 'Persistent vomiting or inability to drink fluids', 'Worsening pain despite rest'],
      specialist: 'General Physician / Family Doctor',
    };
  }, [events, symptomInput, severity, timeLabel, redFlagResult, combinedSymptomText]);

  // Handle Submitting Symptom Check
  const handleSubmitCheck = () => {
    if (!symptomInput.trim()) return;

    const newEvt: SymptomEvent = {
      id: `evt-${Date.now()}`,
      timeLabel: timeLabel,
      timestamp: new Date().toISOString(),
      symptomName: symptomInput.trim(),
      severity: severity,
      note: note.trim() || undefined,
    };

    setEvents((prev) => [...prev, newEvt]);
    setSymptomInput('');
    setNote('');
    setCurrentStep('summary');
    setToastMessage(`Checked "${newEvt.symptomName}". Here is your health advice.`);
  };

  // Quick chip click: fills input and auto-submits or lets user customize
  const handleQuickChipSelect = (chip: typeof COMMON_SYMPTOM_CHIPS[0]) => {
    const newEvt: SymptomEvent = {
      id: `evt-${Date.now()}`,
      timeLabel: chip.time,
      timestamp: new Date().toISOString(),
      symptomName: chip.name,
      severity: chip.defaultSeverity,
      note: undefined,
    };

    setEvents((prev) => [...prev, newEvt]);
    setSymptomInput('');
    setNote('');
    setCurrentStep('summary');
    setToastMessage(`Added "${chip.name}" to your check.`);
  };

  // Delete event
  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      if (updated.length === 0) {
        setCurrentStep('input');
      }
      return updated;
    });
  };

  // Save episode to Medical Record (Timeline)
  const handleSaveEpisode = async () => {
    if (events.length === 0) return;
    setIsSaving(true);

    try {
      await Promise.all(
        events.map((evt) =>
          sideEffectsRepo.createSideEffect({
            user_id: effectiveUserId,
            profile_id: effectiveProfileId,
            medicine_id: null,
            medicine_name: 'Symptom Log',
            note: `${evt.timeLabel}: ${evt.symptomName} (${evt.severity})${evt.note ? ` — ${evt.note}` : ''}`,
            severity: evt.severity,
            occurred_at: evt.timestamp,
          })
        )
      );

      setToastMessage('Saved symptom record to your Medical Timeline.');
      setTimeout(() => {
        navigate('/timeline');
      }, 1000);
    } catch (err) {
      console.error('Failed to save symptom episode:', err);
      setToastMessage('Failed to save record.');
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Summary for Doctor
  const handleCopyDoctorSummary = () => {
    const lines = [
      `*MEDFOLIO HEALTH SYMPTOM SUMMARY*`,
      `Patient: ${profile?.full_name || 'Patient'} | Date: ${today}`,
      `Status: ${triageAssessment.badgeLabel}`,
      ``,
      `*SYMPTOMS REPORTED:*`,
      ...events.map((e, idx) => `${idx + 1}. ${e.symptomName} (${e.severity.toUpperCase()}) — ${e.timeLabel}${e.note ? ` [Note: ${e.note}]` : ''}`),
      ``,
      `*GUIDANCE & NOTES:*`,
      `• Overview: ${triageAssessment.summary}`,
      medicationCorrelations.length > 0
        ? `• Prescription Cross-Check: ${medicationCorrelations.map((m) => `${m.medName} (${m.suspectedLink})`).join('; ')}`
        : '',
      ``,
      `Generated via Medfolio Health Assistant`,
    ].filter(Boolean);

    const formatted = lines.join('\n');
    navigator.clipboard.writeText(formatted);
    setToastMessage('Copied summary for your doctor to clipboard!');
  };

  return (
    <AppShell>
      <PageHeader
        title="Symptom Checker & Health Advice"
        description="A simple, reassuring way to check what you're feeling, get home care tips, and know when to see a doctor."
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* CRITICAL EMERGENCY WARNING BANNER (Shows anywhere if red flag is triggered) */}
        {redFlagResult.isEmergency && (
          <div className="rounded-2xl border-2 border-risk-border bg-risk-bg text-risk-text p-5 sm:p-6 shadow-lg animate-pulse">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-risk-fill text-content-onaccent flex items-center justify-center shrink-0 shadow-sm">
                <EmergencyAmbulanceIcon size={24} />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5">
                    <AlertTriangleIcon size={18} className="text-risk-text shrink-0" /> Immediate Medical Attention Recommended
                  </h2>
                  <Badge tone="risk" size="sm">Urgent</Badge>
                </div>

                <p className="text-xs sm:text-sm">
                  Your symptoms match warning criteria:{' '}
                  <span className="font-bold underline">{redFlagResult.matchedLabels.join(', ')}</span>.
                  Please do not wait. Visit an emergency room or call for help immediately.
                </p>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {EMERGENCY_HELPLINES.map((helpline) => (
                    <a
                      key={helpline.number}
                      href={helpline.tel}
                      className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-raised text-risk-text border border-risk-border font-bold text-xs hover:bg-risk-bg transition-all active:scale-95 shadow-2xs"
                    >
                      <PhoneIcon size={14} />
                      <span>{helpline.number}</span>
                      <span className="text-2xs text-content-muted">({helpline.name})</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: FRIENDLY INPUT CARD */}
        {currentStep === 'input' && (
          <div className="space-y-5">
            <div className="p-5 sm:p-7 rounded-3xl bg-surface-raised border border-line shadow-card space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg sm:text-xl font-bold text-content flex items-center gap-2">
                  <span>How are you feeling right now?</span>
                </h2>
                <p className="text-xs sm:text-sm text-content-muted">
                  Choose a common symptom below or describe what you are experiencing.
                </p>
              </div>

              {/* 1-Tap Quick Common Symptoms */}
              <div className="space-y-2.5">
                <span className="text-2xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1">
                  <SparklesIcon size={13} className="text-accent" /> Popular Symptoms (1-Tap Check)
                </span>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SYMPTOM_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickChipSelect(chip)}
                      className="px-3 py-1.5 rounded-xl bg-surface-sunken hover:bg-accent-subtle hover:text-accent hover:border-accent/40 border border-line text-content text-xs font-medium transition-all active:scale-95 shadow-2xs"
                    >
                      + {chip.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Symptom Input Form */}
              <div className="pt-2 border-t border-line space-y-4">
                <div>
                  <label htmlFor="custom-symptom" className="block text-xs sm:text-sm font-bold text-content mb-1.5">
                    Or type your symptom:
                  </label>
                  <input
                    id="custom-symptom"
                    type="text"
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && symptomInput.trim()) {
                        handleSubmitCheck();
                      }
                    }}
                    placeholder="e.g. Throbbing headache, nausea after lunch, scratchy throat..."
                    className="w-full h-11 px-3.5 text-sm bg-surface-sunken border border-line rounded-xl text-content placeholder:text-content-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>

                {/* Severity Level Selection */}
                <div>
                  <span className="block text-xs sm:text-sm font-bold text-content mb-1.5">
                    How intense does it feel?
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { key: 'mild' as const, label: 'Mild', desc: 'Manageable & light' },
                      { key: 'moderate' as const, label: 'Moderate', desc: 'Uncomfortable' },
                      { key: 'severe' as const, label: 'Severe', desc: 'Very intense / heavy' },
                    ].map((item) => {
                      const isSelected = severity === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSeverity(item.key)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            isSelected
                              ? item.key === 'severe'
                                ? 'bg-risk-bg border-risk-border text-risk-text shadow-xs ring-1 ring-risk-border'
                                : item.key === 'moderate'
                                ? 'bg-warn-bg border-warn-border text-warn-text shadow-xs ring-1 ring-warn-border'
                                : 'bg-ok-bg border-ok-border text-ok-text shadow-xs ring-1 ring-ok-border'
                              : 'bg-surface-sunken border-line text-content-muted hover:border-line-strong'
                          }`}
                        >
                          <span className="font-bold text-xs sm:text-sm capitalize">{item.label}</span>
                          <span className="text-2xs opacity-80 mt-0.5">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time & Optional Context */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label htmlFor="time-select" className="block text-xs font-semibold text-content mb-1">
                      When did it start?
                    </label>
                    <Select
                      id="time-select"
                      value={timeLabel}
                      onValueChange={(val) => setTimeLabel(val)}
                      options={TIME_OPTIONS.map((opt) => ({ value: opt, label: opt }))}
                      className="h-10 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label htmlFor="extra-note" className="block text-xs font-semibold text-content mb-1">
                      Extra notes (Optional)
                    </label>
                    <input
                      id="extra-note"
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Started after lunch, feels dull..."
                      className="w-full h-10 px-3 text-xs bg-surface-sunken border border-line rounded-xl text-content placeholder:text-content-subtle focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSubmitCheck}
                    disabled={!symptomInput.trim()}
                    className="w-full font-bold h-11 text-sm rounded-xl flex items-center justify-center gap-2"
                  >
                    <span>Check Symptoms & Get Guidance</span>
                    <ArrowRightIcon size={16} />
                  </Button>
                </div>
              </div>
            </div>

            {/* If there were previous events logged today, show a small link to view summary */}
            {events.length > 0 && (
              <div className="p-4 rounded-2xl bg-surface-raised border border-line flex items-center justify-between text-xs">
                <span className="text-content-muted">
                  You already have <strong className="text-content">{events.length}</strong> symptom(s) logged today.
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep('summary')}
                  className="font-bold text-accent hover:underline flex items-center gap-1"
                >
                  <span>View Advice & Summary</span>
                  <ArrowRightIcon size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: CALM HEALTH SUMMARY & ADVICE CARD */}
        {currentStep === 'summary' && (
          <div className="space-y-6">
            {/* Navigation back to input / add more */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep('input')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-content-muted hover:text-content transition-colors px-2 py-1 rounded-lg hover:bg-surface-raised"
              >
                <ArrowLeftIcon size={15} />
                <span>+ Add Another Symptom</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEvents([]);
                  setCurrentStep('input');
                }}
                className="inline-flex items-center gap-1 text-2xs text-risk-text hover:underline font-semibold"
              >
                <TrashIcon size={13} />
                <span>Start Over</span>
              </button>
            </div>

            {/* Active Symptom Pills Summary */}
            <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-xs space-y-2">
              <span className="text-2xs font-bold text-content-muted uppercase tracking-wider block">
                Symptoms In This Check ({events.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-sunken border border-line text-xs font-semibold text-content"
                  >
                    <span>{evt.symptomName}</span>
                    <Badge
                      tone={evt.severity === 'severe' ? 'risk' : evt.severity === 'moderate' ? 'warn' : 'ok'}
                      size="sm"
                    >
                      {evt.severity}
                    </Badge>
                    <span className="text-2xs text-content-subtle font-normal">({evt.timeLabel})</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(evt.id)}
                      className="text-content-subtle hover:text-risk-text transition-colors p-0.5"
                      title="Remove symptom"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Medication Cross-Correlation Alert */}
            {medicationCorrelations.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-warn-bg border border-warn-border text-warn-text shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                  <MedicineIcon size={17} className="text-warn-text shrink-0" />
                  <span>Medication Insight ({medicationCorrelations.length} potential link)</span>
                </div>
                <div className="space-y-2 text-xs">
                  {medicationCorrelations.map((corr, cIdx) => (
                    <div key={cIdx} className="p-3 rounded-xl bg-surface-raised border border-warn-border/50 text-content space-y-1">
                      <div className="flex items-center justify-between font-bold text-xs text-accent">
                        <span>{corr.medName}</span>
                        <Badge tone="warn" size="sm">{corr.confidence} Link</Badge>
                      </div>
                      <p className="text-xs text-content-muted leading-relaxed">{corr.suspectedLink}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Core Reassuring Advice Card */}
            <div className="p-5 sm:p-7 rounded-3xl bg-surface-raised border border-line shadow-card space-y-6">
              {/* Status Header */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border space-y-1.5 ${
                  triageAssessment.level === 'red'
                    ? 'bg-risk-bg border-risk-border text-risk-text'
                    : triageAssessment.level === 'amber'
                    ? 'bg-warn-bg border-warn-border text-warn-text'
                    : 'bg-ok-bg border-ok-border text-ok-text'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-2xs font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-raised/60 border border-current/20">
                    {triageAssessment.badgeLabel}
                  </span>
                  <span className="text-2xs font-semibold opacity-90 flex items-center gap-1">
                    <StethoscopeIcon size={13} /> General Guidance
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base">{triageAssessment.headline}</h3>
                <p className="text-xs sm:text-sm opacity-90 leading-relaxed pt-0.5">{triageAssessment.summary}</p>
              </div>

              {/* What You Can Do (Home Comfort & Care) */}
              <div className="space-y-2.5">
                <h4 className="text-xs sm:text-sm font-bold text-content flex items-center gap-2">
                  <CheckIcon size={16} className="text-ok-text" /> What you can do right now:
                </h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  {triageAssessment.homeCare.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-sunken border border-line text-content">
                      <span className="w-5 h-5 rounded-full bg-ok-bg text-ok-text border border-ok-border font-bold text-2xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Signs to Watch Out For */}
              <div className="space-y-2.5 pt-2 border-t border-line">
                <h4 className="text-xs sm:text-sm font-bold text-content flex items-center gap-2">
                  <AlertTriangleIcon size={15} className="text-warn-text" /> When to see a doctor (Signs to watch):
                </h4>
                <ul className="space-y-1.5 text-xs text-content-muted pl-1">
                  {triageAssessment.nextRedFlags.map((sign, sIdx) => (
                    <li key={sIdx} className="flex items-start gap-2">
                      <span className="text-warn-text font-bold mt-0.5">•</span>
                      <span className="leading-relaxed">{sign}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Medical Specialist */}
              <div className="p-3.5 rounded-xl bg-surface-sunken border border-line flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-content-muted">Recommended Specialist:</span>
                <span className="font-bold text-content">{triageAssessment.specialist}</span>
              </div>

              {/* Primary Action Buttons */}
              <div className="pt-2 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSaveEpisode}
                  loading={isSaving}
                  disabled={events.length === 0}
                  className="font-bold text-xs sm:text-sm h-11 rounded-xl"
                  leftIcon={<CheckIcon size={16} />}
                >
                  Save to Health Timeline
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleCopyDoctorSummary}
                  disabled={events.length === 0}
                  className="font-bold text-xs sm:text-sm h-11 rounded-xl"
                  leftIcon={<CopyIcon size={16} />}
                >
                  Copy Summary for Doctor
                </Button>
              </div>
            </div>

            {/* Collapsible History Section (Keeps screen clean) */}
            <div className="rounded-2xl border border-line bg-surface-raised overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setShowTimelineHistory(!showTimelineHistory)}
                className="w-full p-4 flex items-center justify-between text-xs font-bold text-content hover:bg-surface-sunken transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FolderIcon size={16} className="text-accent" />
                  <span>View Detailed Episode Timeline ({events.length} Events)</span>
                </div>
                {showTimelineHistory ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
              </button>

              {showTimelineHistory && (
                <div className="p-4 pt-0 border-t border-line space-y-2.5 bg-surface-sunken/40">
                  <div className="pt-3 space-y-2">
                    {events.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3 rounded-xl bg-surface-raised border border-line text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-content">{evt.symptomName}</span>
                            <Badge
                              tone={evt.severity === 'severe' ? 'risk' : evt.severity === 'moderate' ? 'warn' : 'ok'}
                              size="sm"
                            >
                              {evt.severity}
                            </Badge>
                          </div>
                          {evt.note && <p className="text-2xs text-content-muted">{evt.note}</p>}
                        </div>
                        <span className="text-2xs text-content-subtle font-medium">{evt.timeLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Collapsible Emergency Numbers Box */}
            <div className="rounded-2xl border border-line bg-surface-raised overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setShowHelplines(!showHelplines)}
                className="w-full p-4 flex items-center justify-between text-xs font-bold text-content hover:bg-surface-sunken transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PhoneIcon size={16} className="text-risk-text" />
                  <span>Emergency Contacts & Helplines</span>
                </div>
                {showHelplines ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
              </button>

              {showHelplines && (
                <div className="p-4 pt-0 border-t border-line space-y-2 bg-surface-sunken/40">
                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EMERGENCY_HELPLINES.map((hl) => (
                      <div
                        key={hl.number}
                        className="p-2.5 rounded-xl border border-line bg-surface-raised flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-content block text-xs">{hl.name}</span>
                          <span className="text-2xs text-content-subtle">{hl.description}</span>
                        </div>
                        <a
                          href={hl.tel}
                          className="px-2.5 py-1 rounded-lg bg-risk-bg text-risk-text border border-risk-border font-bold text-2xs hover:bg-red-100 flex items-center gap-1"
                        >
                          <PhoneIcon size={12} /> {hl.number}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Disclaimer text={SYMPTOM_DISCLAIMER} />
      </div>
    </AppShell>
  );
}
