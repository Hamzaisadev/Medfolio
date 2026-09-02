import { useState, useRef } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Toast } from '../ui/Toast';
import { CopyIcon, PrinterIcon, DownloadIcon, SparklesIcon } from '../ui/icons';
import { exportElementToPdf } from '../../lib/export/pdfExport';
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
  const [isExporting, setIsExporting] = useState(false);
  const briefRef = useRef<HTMLDivElement>(null);

  const lastVisit = visits[0];
  const lastReport = reports[0];

  const suggestedQuestions = [
    lastVisit?.diagnosis
      ? `Review progress on my treatment for "${lastVisit.diagnosis}" and determine if dose adjustments are needed.`
      : 'Review my current medication schedule and check if all active drugs remain necessary.',
    lastReport?.title
      ? `Discuss recent findings from my "${lastReport.title}" (${lastReport.report_date}).`
      : 'Check if any routine preventive diagnostic panels or blood screenings are due.',
    sideEffects.length > 0
      ? `Evaluate documented symptom: "${sideEffects[0]?.note || 'Unusual discomfort'}" to rule out medication adverse reactions.`
      : 'Ask if any of my current medications interact with common over-the-counter drugs or supplements.',
    'Confirm what specific symptoms should prompt me to seek immediate emergency care before the next visit.',
  ];

  const handleCopySummary = async () => {
    const summaryText = [
      `DOCTOR PRE-VISIT CLINICAL SUMMARY - ${profile?.full_name || 'Patient'}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Blood Group: ${profile?.blood_group || 'Unspecified'} | Allergies: ${profile?.allergies || 'NKDA'}`,
      `Conditions: ${profile?.chronic_conditions || 'None'}`,
      '\nTOP QUESTIONS FOR DOCTOR:',
      ...suggestedQuestions.map((q, i) => `${i + 1}. ${q}`),
      '\nACTIVE MEDICATIONS:',
      ...medicines.map(
        (m) =>
          `- ${m.medicine_name} ${m.strength || ''} (${m.frequency_code || m.frequency_raw || 'OD'})`
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summaryText);
      setToastMessage('Clinical brief copied to clipboard.');
    } catch {
      setToastMessage('Failed to copy summary.');
    }
  };

  const handleExportPdf = async () => {
    if (!briefRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const slug = (profile?.full_name || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportElementToPdf(briefRef.current, {
        filename: `${slug}_Doctor_Prep_Brief.pdf`,
      });
    } catch (err) {
      console.error('Failed to export brief PDF:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={briefRef} className="space-y-4">
      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-surface-raised border border-line-strong shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-content flex items-center gap-1.5">
            <SparklesIcon size={16} className="text-accent shrink-0" /> Pre-Consultation Clinical Brief
          </h3>
          <p className="text-xs text-content-muted mt-0.5">
            Auto-synthesized checklist of targeted questions, active medications, and symptoms for your doctor.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleCopySummary} leftIcon={<CopyIcon size={14} />}>
            Copy Summary
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()} leftIcon={<PrinterIcon size={14} />}>
            Print
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExporting}
            leftIcon={<DownloadIcon size={14} />}
          >
            {isExporting ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Top 4 Targeted Questions for Physician */}
      <Card header={<h3 className="text-sm font-bold text-content">Recommended Questions to Ask Your Doctor</h3>}>
        <div className="space-y-3">
          {suggestedQuestions.map((q, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-line bg-surface-sunken flex items-start gap-3 text-xs"
            >
              <div className="w-5 h-5 rounded-full bg-accent text-accent-onaccent font-bold flex items-center justify-center shrink-0 text-[11px]">
                {idx + 1}
              </div>
              <p className="text-content font-medium leading-relaxed flex-1">{q}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Medications List */}
        <Card header={<h3 className="text-sm font-bold text-content">Current Medications ({medicines.length})</h3>}>
          {medicines.length === 0 ? (
            <p className="text-xs text-content-subtle italic py-2">No active prescriptions.</p>
          ) : (
            <div className="space-y-2">
              {medicines.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl border border-line bg-surface-sunken flex justify-between items-center text-xs">
                  <span className="font-bold text-content">{m.medicine_name} {m.strength || ''}</span>
                  <Badge tone="neutral" size="sm">{m.frequency_code || 'OD'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Symptoms & Recent Changes */}
        <Card header={<h3 className="text-sm font-bold text-content">Recent Symptoms & Side-Effects</h3>}>
          {sideEffects.length === 0 ? (
            <div className="p-4 text-center text-xs text-content-muted bg-surface-sunken rounded-xl">
              No recent symptoms or adverse side effects logged since your last visit.
            </div>
          ) : (
            <div className="space-y-2">
              {sideEffects.slice(0, 4).map((s) => (
                <div key={s.id} className="p-2.5 rounded-xl border border-line bg-surface-sunken text-xs">
                  <span className="font-semibold text-content block">{s.note}</span>
                  <span className="text-[10px] text-content-subtle">{s.occurred_at?.slice(0, 10) || 'Recent'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {onAskAssistant && (
        <div className="p-4 rounded-2xl border border-line bg-surface-raised shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-bold text-content block">Want personalized questions for a specific doctor?</span>
            <span className="text-content-muted">Ask the clinical assistant to formulate questions based on your symptoms.</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              onAskAssistant(
                'Please draft a list of specific questions I should ask my doctor during my next consultation based on my active medicines and lab results.'
              )
            }
            className="shrink-0"
          >
            Customize Questions &rarr;
          </Button>
        </div>
      )}
    </div>
  );
}
