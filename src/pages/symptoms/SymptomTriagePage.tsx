import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Textarea } from '../../components/ui/Textarea';
import { Toast } from '../../components/ui/Toast';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { EmergencyAmbulanceIcon, AlertTriangleIcon, PhoneIcon } from '../../components/ui/icons';
import { checkRedFlags, EMERGENCY_HELPLINES } from '../../domain/redFlags';
import { sideEffectsRepo } from '../../lib/db';
import { SYMPTOM_DISCLAIMER } from '../../lib/disclaimer';
import { useAuth } from '../../lib/auth/AuthContext';

export function SymptomTriagePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [symptomText, setSymptomText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  // Offline Zero-Network Red Flag Evaluation
  const redFlagResult = useMemo(() => {
    return checkRedFlags(symptomText);
  }, [symptomText]);

  // Suggested Medical Specialist (Non-emergency guidance)
  const suggestedSpecialist = useMemo(() => {
    if (!symptomText.trim()) return null;
    const text = symptomText.toLowerCase();

    if (text.includes('skin') || text.includes('rash') || text.includes('itching') || text.includes('acne') || text.includes('khujli')) {
      return { specialist: 'Dermatologist (Skin Specialist)', advice: 'For skin rashes, allergic dermatitis, or persistent lesions.' };
    }
    if (text.includes('stomach') || text.includes('acid') || text.includes('vomit') || text.includes('motion') || text.includes('pet dard')) {
      return { specialist: 'Gastroenterologist', advice: 'For abdominal pain, severe reflux, or chronic bowel irregularities.' };
    }
    if (text.includes('joint') || text.includes('knee') || text.includes('back pain') || text.includes('bone') || text.includes('gardan dard')) {
      return { specialist: 'Orthopedic Surgeon / Rheumatologist', advice: 'For joint inflammation, bone injuries, or chronic back pain.' };
    }
    if (text.includes('headache') || text.includes('migraine') || text.includes('dizziness') || text.includes('chakkar')) {
      return { specialist: 'Neurologist / General Physician', advice: 'For recurrent migraines, vertigo, or unusual neurological pain.' };
    }
    if (text.includes('eye') || text.includes('vision') || text.includes('aankh')) {
      return { specialist: 'Ophthalmologist (Eye Specialist)', advice: 'For vision changes, redness, or ocular pain.' };
    }
    if (text.includes('throat') || text.includes('ear') || text.includes('nose') || text.includes('sinus') || text.includes('gala')) {
      return { specialist: 'ENT Specialist (Otolaryngologist)', advice: 'For ear infections, sinus congestion, or tonsillitis.' };
    }
    if (text.includes('sugar') || text.includes('diabetes') || text.includes('thyroid') || text.includes('weight')) {
      return { specialist: 'Endocrinologist', advice: 'For glucose fluctuations, metabolic disorders, or hormonal imbalances.' };
    }
    if (text.includes('fever') || text.includes('flu') || text.includes('cough') || text.includes('bukhar') || text.includes('khansi')) {
      return { specialist: 'General Physician / Family Medicine', advice: 'For acute viral symptoms, infections, and general medical evaluation.' };
    }

    return { specialist: 'General Physician / Internal Medicine', advice: 'Comprehensive first-line evaluation for symptoms and referral.' };
  }, [symptomText]);

  const handleLogSymptom = async () => {
    if (!symptomText.trim()) return;
    setIsSaving(true);
    try {
      await sideEffectsRepo.createSideEffect({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        medicine_id: null,
        medicine_name: 'Self-logged symptom',
        note: `${symptomText.trim()}${durationText ? ` (Duration: ${durationText})` : ''}`,
        severity,
        occurred_at: new Date().toISOString(),
      });

      setToastMessage('Symptom logged to your medical timeline.');
      setTimeout(() => {
        navigate('/timeline');
      }, 1000);
    } catch (err) {
      console.error('Failed to log symptom:', err);
      setToastMessage('Failed to save symptom note.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Symptom & Triage Guidance"
        description="Check symptoms offline for emergency red flags and find appropriate medical specialist recommendations."
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* EMERGENCY RED FLAG BANNER — Evaluated 100% locally on typing */}
      {redFlagResult.isEmergency && (
        <div className="mb-6 rounded-[var(--radius-lg)] border-2 border-red-600 bg-red-600 text-white p-6 shadow-xl animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white text-red-600 flex items-center justify-center shrink-0">
              <EmergencyAmbulanceIcon size={28} />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangleIcon className="w-6 h-6 text-white" /> Potential Medical Emergency Detected
                </h2>
                <Badge tone="neutral" size="sm" className="bg-white/20 text-white border-0">
                  Offline Safety Rule
                </Badge>
              </div>

              <p className="text-sm font-medium text-red-100">
                Your entered symptoms match emergency criteria:{' '}
                <span className="font-bold text-white underline">
                  {redFlagResult.matchedLabels.join(', ')}
                </span>
                . Do not wait for an appointment. Seek immediate emergency medical care.
              </p>

              <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {EMERGENCY_HELPLINES.map((helpline) => (
                  <a
                    key={helpline.number}
                    href={helpline.tel}
                    className="flex flex-col items-center justify-center p-3 rounded-lg bg-white text-red-700 hover:bg-red-50 transition-transform active:scale-95 shadow-md font-bold text-center"
                  >
                    <span className="text-lg">{helpline.number}</span>
                    <span className="text-xs text-ink-600">{helpline.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Symptom Input Card */}
        <div className="lg:col-span-7 space-y-6">
          <Card header={<h2 className="text-base font-bold text-ink-900">Describe Your Symptoms</h2>}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-ink-700 block mb-1.5">
                  What are you experiencing? (English or Urdu)
                </label>
                <Textarea
                  value={symptomText}
                  onChange={(e) => setSymptomText(e.target.value)}
                  placeholder="e.g. Mild pain in right shoulder since yesterday, dry cough, acidity, sar dard..."
                  rows={4}
                />
                <span className="text-[11px] text-ink-400 mt-1 block">
                  Checks instantly for red flags locally with zero network requests.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-ink-700 block mb-1.5">Duration</label>
                  <input
                    type="text"
                    value={durationText}
                    onChange={(e) => setDurationText(e.target.value)}
                    placeholder="e.g. 2 days, 3 hours"
                    className="w-full h-11 px-3.5 py-2 text-sm bg-surface-primary border border-ink-200 rounded-[var(--radius-md)] text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-ink-700 block mb-1.5">Perceived Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                    className="w-full h-11 px-3.5 py-2 text-sm bg-surface-primary border border-ink-200 rounded-[var(--radius-md)] text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="mild">Mild — Slight discomfort, manageable</option>
                    <option value="moderate">Moderate — Interferes with daily tasks</option>
                    <option value="severe">Severe — High distress or pain</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-ink-100">
                <Button variant="ghost" size="sm" onClick={() => setSymptomText('')}>
                  Clear
                </Button>
                <Button
                  variant="primary"
                  onClick={handleLogSymptom}
                  loading={isSaving}
                  disabled={!symptomText.trim()}
                >
                  Log to Medical Timeline &rarr;
                </Button>
              </div>
            </div>
          </Card>

          {/* Clinical Disclaimer */}
          <Disclaimer text={SYMPTOM_DISCLAIMER} />
        </div>

        {/* Right Column: Specialist Suggestions & Emergency Helplines */}
        <div className="lg:col-span-5 space-y-6">
          {/* Specialist Recommendation */}
          {suggestedSpecialist && (
            <Card
              header={
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-ink-900">Recommended Specialist</h2>
                  <Badge tone="ok" size="sm">Triage guidance</Badge>
                </div>
              }
            >
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200">
                  <span className="font-bold text-sm text-teal-900 block">
                    {suggestedSpecialist.specialist}
                  </span>
                  <p className="text-xs text-teal-700 mt-1 leading-relaxed">
                    {suggestedSpecialist.advice}
                  </p>
                </div>

                <p className="text-xs text-ink-500 leading-relaxed">
                  If this is a chronic symptom, bring your printed <strong>Doctor Brief</strong> with your active medication list to your consultation.
                </p>
              </div>
            </Card>
          )}

          {/* Quick Helplines Row */}
          <Card header={<h2 className="text-base font-bold text-ink-900">Emergency Numbers (Pakistan)</h2>}>
            <div className="space-y-2 text-xs">
              {EMERGENCY_HELPLINES.map((hl) => (
                <div
                  key={hl.number}
                  className="flex items-center justify-between p-3 rounded-md border border-ink-200 bg-white"
                >
                  <div>
                    <span className="font-bold text-ink-900 block">{hl.name}</span>
                    <span className="text-ink-500 text-[11px]">{hl.description}</span>
                  </div>
                  <a
                    href={hl.tel}
                    className="px-3 py-1.5 rounded-md bg-risk-bg text-risk-text border border-risk-border font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5"
                  >
                    <PhoneIcon size={14} /> Call {hl.number}
                  </a>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
