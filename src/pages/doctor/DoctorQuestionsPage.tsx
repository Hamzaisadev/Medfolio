import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { useAuth } from '../../lib/auth/AuthContext';
import { listMedicines } from '../../lib/db/medicines';
import { listReports, getReportResults } from '../../lib/db/reports';
import { listGlucoseReadings, listBloodPressureReadings } from '../../lib/db/vitals';
import { generateDoctorQuestions, DoctorQuestion } from '../../domain/doctorQuestions';
import { Button } from '../../components/ui/Button';
import { CopyIcon, PrinterIcon, SparklesIcon, CheckIcon } from '../../components/ui/icons';

export function DoctorQuestionsPage() {
  const { user, profile } = useAuth();
  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const [questions, setQuestions] = useState<DoctorQuestion[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [customQuestionText, setCustomQuestionText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadClinicalData() {
      if (!effectiveProfileId) return;
      setIsLoading(true);
      try {
        const [medicines, reports, glucose, bp] = await Promise.all([
          listMedicines(effectiveProfileId),
          listReports(effectiveProfileId),
          listGlucoseReadings(effectiveProfileId),
          listBloodPressureReadings(effectiveProfileId),
        ]);

        const allResults = await Promise.all(
          reports.slice(0, 5).map((r) => getReportResults(r.id))
        );
        const flatResults = allResults.flat();

        const generated = generateDoctorQuestions({
          medicines,
          labResults: flatResults,
          glucoseReadings: glucose,
          bpReadings: bp,
          chronicConditions: profile?.chronic_conditions || undefined,
        });

        setQuestions(generated);
      } catch (err) {
        console.error('Failed to generate consultation questions:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadClinicalData();
  }, [effectiveProfileId, profile?.chronic_conditions]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddCustomQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestionText.trim()) return;

    const newQ: DoctorQuestion = {
      id: `custom-${Date.now()}`,
      category: 'general',
      categoryLabel: 'Patient Question',
      priority: 'medium',
      question: customQuestionText.trim(),
      context: 'Custom topic added by patient',
    };

    setQuestions((prev) => [newQ, ...prev]);
    setCustomQuestionText('');
  };

  const handleCopyQuestions = async () => {
    const text = [
      `🩺 Doctor Consultation Checklist — ${profile?.full_name || 'Patient'}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      ...questions.map((q, idx) => {
        const isChecked = checkedIds.has(q.id);
        return `${idx + 1}. [${isChecked ? 'X' : ' '}] (${q.priority.toUpperCase()}) ${q.question}\n   Context: ${q.context}`;
      }),
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto print:max-w-full print:p-0">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/doctors" className="text-xs font-semibold text-teal-800 hover:underline print:hidden">
                ← Doctors Directory
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-ink-900 tracking-tight mt-1 flex items-center gap-2">
              <span>Smart Doctor Questions</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                Consultation Ready
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-600 mt-1">
              Personalized clinical questions synthesized from your recent prescriptions, out-of-range lab results, and vitals anomalies.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyQuestions}
              leftIcon={copied ? <CheckIcon size={14} className="text-emerald-600" /> : <CopyIcon size={14} />}
            >
              {copied ? 'Copied to Clipboard' : 'Copy All'}
            </Button>
            <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<PrinterIcon size={14} />}>
              Print Checklist
            </Button>
          </div>
        </div>

        {/* Custom Question Quick Input */}
        <form onSubmit={handleAddCustomQuestion} className="flex gap-2 print:hidden">
          <input
            type="text"
            value={customQuestionText}
            onChange={(e) => setCustomQuestionText(e.target.value)}
            placeholder="Add your own question or concern to discuss..."
            className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-ink-200 bg-white focus:outline-teal-600 text-ink-900 shadow-2xs"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!customQuestionText.trim()}>
            + Add Question
          </Button>
        </form>

        {/* Questions Checklist */}
        {isLoading ? (
          <div className="py-12 text-center text-xs text-ink-500">
            Synthesizing clinical questions from your medical records...
          </div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white border border-ink-200 text-xs text-ink-500">
            No pending questions detected. You can add your own questions above!
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => {
              const isChecked = checkedIds.has(q.id);
              const priorityBadge =
                q.priority === 'high'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : q.priority === 'medium'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-ink-100 text-ink-700 border-ink-200';

              return (
                <div
                  key={q.id}
                  onClick={() => toggleCheck(q.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-ink-50/70 border-ink-200 opacity-70'
                      : 'bg-white border-ink-200/90 hover:border-teal-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by parent div onClick
                      className="mt-1 h-4 w-4 rounded text-teal-800 focus:ring-teal-600 pointer-events-none"
                    />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                          {q.categoryLabel}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${priorityBadge}`}>
                          {q.priority.toUpperCase()} PRIORITY
                        </span>
                      </div>

                      <p
                        className={`text-xs sm:text-sm font-semibold ${
                          isChecked ? 'line-through text-ink-500' : 'text-ink-900'
                        }`}
                      >
                        {q.question}
                      </p>

                      <p className="text-[11px] text-ink-500 font-mono">{q.context}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Consultation Tip Banner */}
        <div className="p-4 rounded-2xl bg-linear-to-r from-teal-50 to-emerald-50 border border-teal-200/80 text-xs text-teal-950 print:hidden flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-teal-100/80 text-teal-900 shrink-0">
            <SparklesIcon size={16} />
          </div>
          <div>
            <p className="font-bold">Consultation Pro-Tip:</p>
            <p className="text-teal-900/90 mt-0.5 leading-relaxed">
              Show this checklist directly to your physician at the start of your consultation so they can address high-priority medication adjustments and abnormal lab biomarkers systematically.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
