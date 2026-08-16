import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Toast } from '../ui/Toast';
import type { MedicineRecord } from '../../domain/activeMedicines';
import type { Tables } from '../../lib/supabase/types';

interface DoctorPrepBriefProps {
  profile: Tables<'profiles'> | null;
  medicines: MedicineRecord[];
  visits: Tables<'visits'>[];
  reports: Tables<'reports'>[];
  sideEffects: Tables<'side_effects'>[];
  onAskAssistant?: (query: string) => void;
}

export function DoctorPrepBrief({
  profile,
  medicines,
  visits,
  reports,
  sideEffects,
  onAskAssistant,
}: DoctorPrepBriefProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const lastVisit = visits[0];
  const lastReport = reports[0];

  const suggestedQuestions = [
    lastVisit?.diagnosis
      ? `Review progress on my treatment for "${lastVisit.diagnosis}" and determine if dose adjustments are needed.`
      : 'Review my current medication schedule and check if all active drugs remain necessary.',
    medicines.length > 2
      ? `Check if my ${medicines.length} active prescriptions have any long-term kidney or liver considerations.`
      : 'Confirm if any over-the-counter painkiller or antacid is safe with my current medications.',
    sideEffects.length > 0
      ? `Discuss recent symptoms I logged: "${sideEffects[0]?.note}".`
      : 'Are there any lifestyle or dietary adjustments to complement my medications?',
    lastReport
      ? `Review my recent lab report "${lastReport.title}" and see if repeat testing is required in 3 to 6 months.`
      : 'Should I schedule routine blood work (e.g. CBC, Fasting Glucose, Lipid Profile) for my next checkup?',
  ];

  const handleCopySummary = () => {
    const text = `MEDFOLIO DOCTOR PRE-CONSULTATION SUMMARY
Patient: ${profile?.full_name || 'Patient'}
Known Allergies: ${profile?.allergies || 'None'}
Chronic Conditions: ${profile?.chronic_conditions || 'None'}

ACTIVE MEDICATIONS (${medicines.length}):
${medicines.map((m) => `- ${m.medicine_name} ${m.strength || ''} (${m.frequency_code || 'Daily'})`).join('\n')}

RECENT SYMPTOMS / NOTES:
${sideEffects.slice(0, 3).map((s) => `- ${s.occurred_at?.slice(0, 10)}: ${s.note}`).join('\n') || 'None'}

TARGETED QUESTIONS FOR PHYSICIAN:
${suggestedQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}
`;

    navigator.clipboard.writeText(text).then(() => {
      setToastMessage('Consultation summary copied to clipboard.');
    });
  };

  return (
    <div className="space-y-6">
      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-teal-800 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm">Pre-Consultation Clinical Brief</h3>
          <p className="text-xs text-teal-200 mt-0.5">
            Auto-synthesized checklist of targeted questions, active medications, and symptoms for your doctor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleCopySummary}>
            📋 Copy Summary
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            🖨️ Print
          </Button>
        </div>
      </div>

      {/* Top 4 Targeted Questions for Physician */}
      <Card header={<h3 className="text-sm font-bold text-ink-900">Recommended Questions to Ask Your Doctor</h3>}>
        <div className="space-y-3">
          {suggestedQuestions.map((q, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-teal-100 bg-teal-50/40 flex items-start gap-3 text-xs"
            >
              <div className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                {idx + 1}
              </div>
              <p className="text-ink-800 font-medium leading-relaxed flex-1">{q}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Medications List */}
        <Card header={<h3 className="text-sm font-bold text-ink-900">Current Medications ({medicines.length})</h3>}>
          {medicines.length === 0 ? (
            <p className="text-xs text-ink-400 italic">No active prescriptions.</p>
          ) : (
            <div className="space-y-2">
              {medicines.map((m) => (
                <div key={m.id} className="p-2.5 rounded-lg border border-ink-100 bg-ink-50/50 flex justify-between items-center text-xs">
                  <span className="font-bold text-ink-900">{m.medicine_name} {m.strength || ''}</span>
                  <Badge tone="neutral" size="sm">{m.frequency_code || 'OD'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Symptoms & Recent Changes */}
        <Card header={<h3 className="text-sm font-bold text-ink-900">Recent Symptoms & Side-Effects</h3>}>
          {sideEffects.length === 0 ? (
            <div className="p-4 text-center text-xs text-ink-500 bg-ink-50 rounded-xl">
              No recent symptoms or adverse side effects logged since your last visit.
            </div>
          ) : (
            <div className="space-y-2">
              {sideEffects.slice(0, 4).map((s) => (
                <div key={s.id} className="p-2.5 rounded-lg border border-ink-100 bg-ink-50/50 text-xs">
                  <span className="font-semibold text-ink-900 block">{s.note}</span>
                  <span className="text-[10px] text-ink-400">{s.occurred_at?.slice(0, 10) || 'Recent'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {onAskAssistant && (
        <div className="p-4 rounded-xl border border-ink-200 bg-white flex items-center justify-between">
          <div className="text-xs">
            <span className="font-bold text-ink-900 block">Want personalized questions for a specific doctor?</span>
            <span className="text-ink-500">Ask the clinical assistant to formulate questions based on your symptoms.</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              onAskAssistant(
                'Please draft a list of specific questions I should ask my doctor during my next consultation based on my active medicines and lab results.'
              )
            }
          >
            Customize Questions &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
