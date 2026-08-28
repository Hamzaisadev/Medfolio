import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toast } from '../../components/ui/Toast';
import { Disclaimer } from '../../components/ui/Disclaimer';
import {
  EmergencyAmbulanceIcon,
  AlertTriangleIcon,
  PhoneIcon,
  ClockIcon,
  CheckIcon,
  CopyIcon,
  TrashIcon,
  MedicineIcon,
  SparklesIcon,
  FolderIcon,
  StethoscopeIcon,
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
  { name: 'Headache', defaultSeverity: 'mild' as const, time: 'Morning' },
  { name: 'Fever (101°F+)', defaultSeverity: 'moderate' as const, time: 'Afternoon' },
  { name: 'Nausea / Vomiting', defaultSeverity: 'moderate' as const, time: 'Evening' },
  { name: 'Dizziness / Vertigo', defaultSeverity: 'mild' as const, time: 'Afternoon' },
  { name: 'Dry Cough', defaultSeverity: 'mild' as const, time: 'Morning' },
  { name: 'Shortness of Breath', defaultSeverity: 'severe' as const, time: 'Just now' },
  { name: 'Stomach Pain / Acidity', defaultSeverity: 'moderate' as const, time: 'Evening' },
  { name: 'Skin Rash / Itching', defaultSeverity: 'mild' as const, time: 'Morning' },
  { name: 'Chest Tightness', defaultSeverity: 'severe' as const, time: 'Just now' },
  { name: 'Muscle / Joint Aches', defaultSeverity: 'mild' as const, time: 'Morning' },
  { name: 'Extreme Fatigue', defaultSeverity: 'mild' as const, time: 'Afternoon' },
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

  // Chronological Symptom Events Timeline State
  const [events, setEvents] = useState<SymptomEvent[]>([
    {
      id: 'initial-event',
      timeLabel: 'Morning (08:00 AM)',
      timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      symptomName: 'Mild Frontal Headache',
      severity: 'mild',
      note: 'Dull ache behind the eyes upon waking up.',
    },
  ]);

  // Form state for adding new events
  const [newSymptomName, setNewSymptomName] = useState('');
  const [newTimeLabel, setNewTimeLabel] = useState('Just now');
  const [newSeverity, setNewSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [newNote, setNewNote] = useState('');

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
    return events.map((e) => `${e.timeLabel}: ${e.symptomName} (${e.severity}) - ${e.note || ''}`).join('\n');
  }, [events]);

  // Offline Zero-Network Emergency Red Flag Detection
  const redFlagResult = useMemo(() => {
    return checkRedFlags(combinedSymptomText);
  }, [combinedSymptomText]);

  // Active Medication Correlation Analysis
  const medicationCorrelations = useMemo(() => {
    if (events.length === 0 || activeMedsList.length === 0) return [];
    const textLower = combinedSymptomText.toLowerCase();
    const correlations: Array<{ medName: string; suspectedLink: string; confidence: 'High' | 'Possible' }> = [];

    activeMedsList.forEach((med) => {
      const nameLower = med.medicine_name.toLowerCase();

      // Calcium Channel Blockers (Amlodipine) -> Swollen ankles / Edema / Dizziness
      if ((nameLower.includes('amlo') || nameLower.includes('norvasc')) && (textLower.includes('swelling') || textLower.includes('ankle') || textLower.includes('foot') || textLower.includes('edema') || textLower.includes('dizzy'))) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Known vasodilatory adverse effect: Peripheral ankle edema and postural dizziness occur in 5-10% of patients on CCBs.',
          confidence: 'High',
        });
      }

      // Metformin -> GI upset / Nausea / Diarrhea / Stomach pain
      if ((nameLower.includes('metformin') || nameLower.includes('glucophage')) && (textLower.includes('nausea') || textLower.includes('vomit') || textLower.includes('stomach') || textLower.includes('diarrhea') || textLower.includes('cramp') || textLower.includes('loose'))) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Gastrointestinal intolerance: Nausea, stomach cramps, and loose stools are common when initiating or adjusting Metformin dose. Best taken strictly with meals.',
          confidence: 'High',
        });
      }

      // ACE Inhibitors (Lisinopril / Enalapril / Ramipril) -> Dry Cough
      if ((nameLower.includes('pril') || nameLower.includes('zestril') || nameLower.includes('tritace')) && (textLower.includes('cough') || textLower.includes('khansi') || textLower.includes('throat'))) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Bradykinin-mediated dry cough: Known class effect in up to 15% of patients taking ACE Inhibitors. Consider asking physician to switch to an ARB (Valsartan/Losartan).',
          confidence: 'High',
        });
      }

      // Statins (Atorvastatin / Rosuvastatin) -> Muscle pain / Myalgia
      if ((nameLower.includes('statin') || nameLower.includes('lipiget') || nameLower.includes('lipitor') || nameLower.includes('rovista')) && (textLower.includes('muscle') || textLower.includes('ache') || textLower.includes('cramp') || textLower.includes('joint') || textLower.includes('dard'))) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Statin-associated muscle symptoms (SAMS): Muscle aching or tenderness. If accompanied by dark tea-colored urine, seek immediate medical review.',
          confidence: 'Possible',
        });
      }

      // Antibiotics (Augmentin, Cipro) -> Loose stools / Rash
      if ((nameLower.includes('augmentin') || nameLower.includes('amoxi') || nameLower.includes('cipro')) && (textLower.includes('diarrhea') || textLower.includes('rash') || textLower.includes('itching'))) {
        correlations.push({
          medName: `${med.medicine_name} ${med.strength || ''}`,
          suspectedLink: 'Antibiotic-associated gut flora alteration or hypersensitivity rash. Space probiotic doses by at least 2 hours.',
          confidence: 'High',
        });
      }
    });

    return correlations;
  }, [events, activeMedsList, combinedSymptomText]);

  // Dynamic Clinical Triage Level Calculation
  const triageAssessment = useMemo(() => {
    if (events.length === 0) {
      return {
        level: 'green' as const,
        title: 'No Active Symptoms Logged',
        badge: '🟢 GREEN — Baseline Normal',
        summary: 'Log symptom events throughout the day to track your health progression.',
        differentialEvolution: ['Add symptoms to view clinical differential assessment.'],
        nextRedFlags: ['Sudden severe chest pain', 'Difficulty breathing', 'Confusion or fainting'],
        homeCare: ['Maintain normal hydration and follow prescribed routine.'],
        specialist: 'General Physician / Internal Medicine',
      };
    }

    if (redFlagResult.isEmergency) {
      return {
        level: 'red' as const,
        title: 'Immediate Emergency Medical Care Required',
        badge: '🔴 RED — Critical Emergency',
        summary: `Your symptoms match acute clinical red flags: ${redFlagResult.matchedLabels.join(', ')}. Do not delay care.`,
        differentialEvolution: [
          `Event Cluster: Critical acute presentation requiring emergency hospital evaluation.`,
          `High-risk differential: Acute cardiac event, severe respiratory compromise, or neurological emergency.`,
        ],
        nextRedFlags: ['Loss of consciousness', 'Severe blue discoloration of lips', 'Inability to speak in full sentences'],
        homeCare: ['Call 1122 / 115 immediately.', 'Rest in a semi-upright position.', 'Do not drive yourself.'],
        specialist: 'Emergency Department / Acute Medical Unit',
      };
    }

    const hasSevere = events.some((e) => e.severity === 'severe');
    const hasModerate = events.some((e) => e.severity === 'moderate');
    const count = events.length;

    // Multi-Symptom Cluster Analysis (e.g. Fever + Vomiting + Headache)
    const textLower = combinedSymptomText.toLowerCase();
    const hasFever = textLower.includes('fever') || textLower.includes('101') || textLower.includes('102') || textLower.includes('bukhar');
    const hasVomit = textLower.includes('vomit') || textLower.includes('nausea') || textLower.includes('loose') || textLower.includes('diarrhea');
    const hasHeadache = textLower.includes('headache') || textLower.includes('sar dard') || textLower.includes('migraine');
    const hasRespiratory = textLower.includes('cough') || textLower.includes('breath') || textLower.includes('throat');

    if (hasSevere || (hasFever && hasVomit) || (hasFever && hasHeadache && count >= 2) || (hasModerate && count >= 2) || count >= 3) {
      const differential: string[] = [];
      if (hasFever && hasVomit) {
        differential.push('Early presentation: Fever + Gastrointestinal loss indicating Acute Gastroenteritis or Systemic Infection.');
        differential.push('Progression Risk: Dehydration and electrolyte imbalance (Sodium/Potassium loss).');
      } else if (hasHeadache && hasFever) {
        differential.push('Early presentation: Fever with headache. Differential includes Acute Viral Syndrome vs Sinusitis.');
        differential.push('Clinical Monitor: Watch closely for neck stiffness or photophobia to rule out meningeal irritation.');
      } else {
        differential.push(`Cumulative Progression: ${count} interconnected symptom events logged across the timeline.`);
        differential.push('Upgraded from mild observation to formal clinical consultation due to symptom accumulation.');
      }

      return {
        level: 'amber' as const,
        title: 'Doctor Visit Recommended (Within 24–48 Hours)',
        badge: '🟡 AMBER — Clinical Evaluation Recommended',
        summary: `You have logged ${count} symptom events with accumulating intensity. A doctor consultation is advised to prevent escalation.`,
        differentialEvolution: differential,
        nextRedFlags: [
          'Inability to keep oral fluids down for > 12 hours',
          'Temperature rising above 102.5°F unresponsive to antipyretics',
          'Development of rash, confusion, or severe lethargy',
        ],
        homeCare: [
          'Hydration: Sip Oral Rehydration Salts (ORS) in small, frequent mouthfuls.',
          'Fever Management: Paracetamol (500mg) every 6-8 hours with food if permitted (Max 4g/day).',
          'Rest: Avoid physical exertion and monitor vitals.',
        ],
        specialist: hasVomit ? 'Gastroenterologist / General Physician' : hasRespiratory ? 'Pulmonologist / ENT' : 'Internal Medicine / Family Physician',
      };
    }

    // Mild Single or Dual Symptom Observation
    const differential = [
      `Initial Phase: Isolated ${events[0]?.symptomName || 'symptom'} logged.`,
      `Clinical Status: Currently manageable with supportive home care and observation.`,
    ];

    return {
      level: 'green' as const,
      title: 'Mild Symptom — Self-Care & Home Monitoring',
      badge: '🟢 GREEN — Self-Care & Home Monitoring',
      summary: `Your symptoms are currently mild and stable. Continue monitoring and log any additional changes.`,
      differentialEvolution: differential,
      nextRedFlags: ['Sudden spike in fever', 'Persistent vomiting', 'Worsening pain despite rest'],
      homeCare: [
        'Ensure adequate water and electrolyte intake.',
        'Get at least 8 hours of restorative sleep.',
        'Log any new symptoms if they appear later in the day.',
      ],
      specialist: 'General Physician / Family Medicine',
    };
  }, [events, redFlagResult, combinedSymptomText]);

  // Add Event Handler
  const handleAddEvent = () => {
    if (!newSymptomName.trim()) return;

    const event: SymptomEvent = {
      id: `evt-${Date.now()}`,
      timeLabel: newTimeLabel,
      timestamp: new Date().toISOString(),
      symptomName: newSymptomName.trim(),
      severity: newSeverity,
      note: newNote.trim() || undefined,
    };

    setEvents((prev) => [...prev, event]);
    setNewSymptomName('');
    setNewNote('');
    setToastMessage(`Added "${event.symptomName}" to today's symptom timeline.`);
  };

  const handleQuickChipAdd = (chip: typeof COMMON_SYMPTOM_CHIPS[0]) => {
    const event: SymptomEvent = {
      id: `evt-${Date.now()}`,
      timeLabel: chip.time,
      timestamp: new Date().toISOString(),
      symptomName: chip.name,
      severity: chip.defaultSeverity,
      note: `Reported ${chip.name.toLowerCase()} episode.`,
    };

    setEvents((prev) => [...prev, event]);
    setToastMessage(`Added "${chip.name}" to timeline.`);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  // 1-Click Save Entire Episode to Medical Timeline
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
            medicine_name: 'Symptom Triage Timeline',
            note: `${evt.timeLabel}: ${evt.symptomName} (${evt.severity})${evt.note ? ` — ${evt.note}` : ''}`,
            severity: evt.severity,
            occurred_at: evt.timestamp,
          })
        )
      );

      setToastMessage('Saved entire symptom episode to your Medical Timeline.');
      setTimeout(() => {
        navigate('/timeline');
      }, 1200);
    } catch (err) {
      console.error('Failed to save symptom episode:', err);
      setToastMessage('Failed to save symptom episode.');
    } finally {
      setIsSaving(false);
    }
  };

  // 1-Click Copy Summary for Doctor / WhatsApp
  const handleCopyDoctorSummary = () => {
    const lines = [
      `*MEDFOLIO CLINICAL SYMPTOM TIMELINE*`,
      `Patient: ${profile?.full_name || 'Patient'} | Date: ${today}`,
      `Triage Status: ${triageAssessment.badge}`,
      ``,
      `*CHRONOLOGICAL EVENT LOG:*`,
      ...events.map((e, idx) => `${idx + 1}. [${e.timeLabel}] ${e.symptomName} (${e.severity.toUpperCase()})${e.note ? ` - ${e.note}` : ''}`),
      ``,
      `*CLINICAL ASSESSMENT:*`,
      `• Summary: ${triageAssessment.summary}`,
      `• Suspected Cause: ${triageAssessment.differentialEvolution.join(' ')}`,
      medicationCorrelations.length > 0
        ? `• Med Correlation: ${medicationCorrelations.map((m) => `${m.medName} (${m.suspectedLink})`).join('; ')}`
        : '',
      ``,
      `Generated via Medfolio Clinical OS`,
    ].filter(Boolean);

    const formatted = lines.join('\n');
    navigator.clipboard.writeText(formatted);
    setToastMessage('Copied Doctor Consultation Brief to clipboard!');
  };

  return (
    <AppShell>
      <PageHeader
        title="Dynamic Symptom Triage & Event Timeline"
        description="Log symptoms chronologically as your day evolves. The clinical AI continuously updates triage, checks red flags, and correlates with your active medications."
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* EMERGENCY RED FLAG BANNER */}
      {redFlagResult.isEmergency && (
        <div className="mb-6 rounded-2xl border-2 border-risk-border bg-risk-bg text-risk-text p-5 sm:p-6 shadow-xl animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-risk-fill text-content-onaccent flex items-center justify-center shrink-0 shadow-md">
              <EmergencyAmbulanceIcon size={26} />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangleIcon className="w-5 h-5 text-risk-text" /> Potential Emergency Red Flag Detected
                </h2>
                <Badge tone="risk" size="sm">
                  Urgent Care
                </Badge>
              </div>

              <p className="text-xs sm:text-sm font-semibold">
                Your entered timeline matches emergency criteria:{' '}
                <span className="underline font-bold">{redFlagResult.matchedLabels.join(', ')}</span>.
                Do not wait. Seek immediate medical emergency care.
              </p>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {EMERGENCY_HELPLINES.map((helpline) => (
                  <a
                    key={helpline.number}
                    href={helpline.tel}
                    className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-raised text-risk-text border border-risk-border hover:bg-risk-bg transition-transform active:scale-95 shadow-xs font-bold text-center"
                  >
                    <span className="text-base sm:text-lg">{helpline.number}</span>
                    <span className="text-2xs text-content-muted">{helpline.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Prescription Cross-Correlation Banner */}
      {medicationCorrelations.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-warn-bg border border-warn-border text-warn-text shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
            <MedicineIcon size={16} className="text-warn-text shrink-0" />
            <span>Medication Cross-Correlation Detected ({medicationCorrelations.length})</span>
          </div>
          <div className="space-y-1.5 text-xs">
            {medicationCorrelations.map((corr, cIdx) => (
              <div key={cIdx} className="p-2.5 rounded-xl bg-surface-raised border border-line text-content space-y-0.5">
                <div className="flex items-center justify-between font-bold text-2xs sm:text-xs text-accent">
                  <span>{corr.medName}</span>
                  <Badge tone="warn" size="sm">{corr.confidence} Correlation</Badge>
                </div>
                <p className="text-2xs sm:text-xs text-content-muted leading-relaxed">{corr.suspectedLink}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Split: Timeline on Left, Real-Time AI Triage Assessment on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chronological Event Stream */}
        <div className="lg:col-span-7 space-y-5">
          {/* Quick 1-Tap Symptom Chips */}
          <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-content flex items-center gap-1.5">
                <SparklesIcon size={14} className="text-accent" /> Quick-Add Common Symptoms
              </span>
              <span className="text-2xs text-content-subtle">1-tap to add to timeline</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {COMMON_SYMPTOM_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickChipAdd(chip)}
                  className="px-2.5 py-1 rounded-xl bg-surface-sunken hover:bg-accent-subtle hover:text-accent border border-line text-content text-2xs font-semibold transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                >
                  <span>+ {chip.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* New Event Logger Form */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-line shadow-card space-y-4">
            <h2 className="text-sm font-bold text-content flex items-center gap-2">
              <ClockIcon size={16} className="text-accent" /> Log Symptom Event
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-content block mb-1">Symptom Name / Feeling</label>
                <input
                  type="text"
                  value={newSymptomName}
                  onChange={(e) => setNewSymptomName(e.target.value)}
                  placeholder="e.g. Throbbing frontal headache, fever, nausea, sore throat..."
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-surface-sunken border border-line rounded-xl text-content placeholder:text-content-subtle focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-content block mb-1">Time of Day</label>
                  <select
                    value={newTimeLabel}
                    onChange={(e) => setNewTimeLabel(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-surface-sunken border border-line rounded-xl text-content focus:outline-none focus:border-accent"
                  >
                    {TIME_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-content block mb-1">Severity Level</label>
                  <div className="grid grid-cols-3 gap-1 h-10">
                    {(['mild', 'moderate', 'severe'] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setNewSeverity(sev)}
                        className={`rounded-xl text-2xs font-bold capitalize transition-all border ${
                          newSeverity === sev
                            ? sev === 'severe'
                              ? 'bg-risk-fill text-content-onaccent border-risk-fill shadow-xs'
                              : sev === 'moderate'
                              ? 'bg-warn-bg text-warn-text border-warn-border shadow-xs'
                              : 'bg-accent text-content-onaccent border-accent shadow-xs'
                            : 'bg-surface-sunken text-content-muted border-line hover:border-line-strong'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-content block mb-1">Context / Details (Optional)</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Started after lunch, accompanied by chills, pain level 5/10..."
                  className="w-full h-10 px-3 text-xs bg-surface-sunken border border-line rounded-xl text-content placeholder:text-content-subtle focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddEvent}
                  disabled={!newSymptomName.trim()}
                  className="text-xs font-bold h-9 px-4 rounded-xl"
                >
                  + Add Event to Timeline
                </Button>
              </div>
            </div>
          </div>

          {/* Chronological Event Progression Stream */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-line shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-content flex items-center gap-1.5">
                <FolderIcon size={15} className="text-accent" />
                <span>Today's Symptom Progression ({events.length} Event{events.length === 1 ? '' : 's'})</span>
              </span>
              {events.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEvents([])}
                  className="text-2xs text-risk-text font-semibold hover:underline flex items-center gap-1"
                >
                  <TrashIcon size={12} /> Clear All
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-surface-sunken border border-line text-content-subtle text-xs space-y-1">
                <p className="font-medium">No symptoms logged in this episode.</p>
                <p className="text-2xs">Use the quick chips above or enter an event to start live clinical tracking.</p>
              </div>
            ) : (
              <div className="space-y-2 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    className="relative pl-8 p-3 rounded-xl bg-surface-sunken border border-line text-xs space-y-1 group hover:border-accent/40 transition-all"
                  >
                    {/* Step Circle Indicator */}
                    <div className="absolute left-2 top-3.5 w-3.5 h-3.5 rounded-full bg-surface-raised border-2 border-accent flex items-center justify-center -translate-x-1/2" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-content text-xs">{evt.symptomName}</span>
                        <Badge
                          tone={evt.severity === 'severe' ? 'risk' : evt.severity === 'moderate' ? 'warn' : 'ok'}
                          size="sm"
                        >
                          {evt.severity}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-2xs text-content-subtle font-medium">{evt.timeLabel}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-risk-text transition-opacity p-0.5"
                          title="Remove event"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    </div>

                    {evt.note && <p className="text-2xs text-content-muted leading-relaxed">{evt.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Disclaimer text={SYMPTOM_DISCLAIMER} />
        </div>

        {/* Right Column: Live Evolving AI Triage Assessment */}
        <div className="lg:col-span-5 space-y-5">
          {/* Evolving Triage Assessment Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-line shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-content flex items-center gap-2">
                <StethoscopeIcon size={17} className="text-accent" /> Live Clinical Triage
              </span>
              <span className="text-2xs text-accent font-bold px-2 py-0.5 rounded-md bg-accent-subtle border border-accent/20">
                Continuous AI Eval
              </span>
            </div>

            {/* Status Rating Badge Header */}
            <div
              className={`p-3.5 rounded-xl border space-y-1 ${
                triageAssessment.level === 'red'
                  ? 'bg-risk-bg border-risk-border text-risk-text'
                  : triageAssessment.level === 'amber'
                  ? 'bg-warn-bg border-warn-border text-warn-text'
                  : 'bg-ok-bg border-ok-border text-ok-text'
              }`}
            >
              <span className="text-2xs font-extrabold uppercase tracking-wider block">
                {triageAssessment.badge}
              </span>
              <h3 className="font-bold text-xs sm:text-sm">{triageAssessment.title}</h3>
              <p className="text-2xs sm:text-xs opacity-90 leading-relaxed">{triageAssessment.summary}</p>
            </div>

            {/* Evolving Clinical Differential Breakdown */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-content block text-2xs uppercase tracking-wider">
                Evolving Clinical Differential
              </span>
              <div className="space-y-1.5">
                {triageAssessment.differentialEvolution.map((diff, dIdx) => (
                  <div key={dIdx} className="p-2.5 rounded-xl bg-surface-sunken border border-line text-content-muted text-2xs space-y-0.5">
                    <p className="leading-relaxed">{diff}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Red Flags to Watch */}
            <div className="space-y-2 text-xs">
              <span className="font-bold text-content block text-2xs uppercase tracking-wider flex items-center gap-1">
                <AlertTriangleIcon size={13} className="text-warn-text" /> Clinical Signs to Monitor Next (12–24h)
              </span>
              <ul className="list-disc list-inside space-y-1 text-content-muted text-2xs">
                {triageAssessment.nextRedFlags.map((rf, rfIdx) => (
                  <li key={rfIdx}>{rf}</li>
                ))}
              </ul>
            </div>

            {/* Recommended Specialist */}
            <div className="p-3 rounded-xl bg-surface-sunken border border-line text-xs space-y-1">
              <span className="text-content-subtle font-semibold block text-2xs">
                Recommended Medical Specialist
              </span>
              <span className="font-bold text-content text-xs">{triageAssessment.specialist}</span>
            </div>

            {/* Evidence-Based Home Care Measures */}
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-content block text-2xs uppercase tracking-wider">
                Home Comfort & Care Protocol
              </span>
              <ul className="space-y-1 text-content-muted text-2xs">
                {triageAssessment.homeCare.map((hc, hIdx) => (
                  <li key={hIdx} className="flex items-start gap-1.5">
                    <CheckIcon size={13} className="text-accent shrink-0 mt-0.5" />
                    <span>{hc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 1-Click Action Buttons */}
            <div className="pt-2 border-t border-line space-y-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyDoctorSummary}
                disabled={events.length === 0}
                className="w-full text-xs font-bold h-9"
                leftIcon={<CopyIcon size={14} />}
              >
                Copy Timeline Summary for Doctor
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEpisode}
                loading={isSaving}
                disabled={events.length === 0}
                className="w-full text-xs font-bold h-9"
                leftIcon={<CheckIcon size={14} />}
              >
                Save Episode to Medical Record
              </Button>
            </div>
          </div>

          {/* Quick Helplines Box */}
          <div className="p-4 rounded-2xl bg-surface-raised border border-line shadow-card space-y-2.5">
            <span className="text-xs font-bold text-content block">Emergency Contacts (Pakistan)</span>
            <div className="space-y-1.5 text-xs">
              {EMERGENCY_HELPLINES.map((hl) => (
                <div
                  key={hl.number}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-surface-sunken"
                >
                  <div>
                    <span className="font-bold text-content text-xs block">{hl.name}</span>
                    <span className="text-content-subtle text-2xs">{hl.description}</span>
                  </div>
                  <a
                    href={hl.tel}
                    className="px-2.5 py-1 rounded-lg bg-risk-bg text-risk-text border border-risk-border font-bold hover:bg-red-100 transition-colors flex items-center gap-1 text-2xs"
                  >
                    <PhoneIcon size={12} /> Call {hl.number}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
