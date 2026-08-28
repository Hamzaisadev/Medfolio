import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Toast } from '../ui/Toast';
import {
  CheckIcon,
  AlertTriangleIcon,
  CopyIcon,
  MedicineIcon,
  CalendarDaysIcon,
  StethoscopeIcon,
  EmergencyAmbulanceIcon,
  HospitalIcon,
  SparklesIcon,
  ClockIcon,
} from '../ui/icons';
import { sideEffectsRepo, testOrdersRepo, visitsRepo, medicinesRepo } from '../../lib/db';
import { todayInAppTz, addDaysAppTz } from '../../lib/time';

export interface ClinicalActionCall {
  type:
    | 'log_symptom'
    | 'adjust_schedule'
    | 'create_refill'
    | 'schedule_followup'
    | 'otc_compatibility'
    | 'emergency_triage'
    | 'missed_dose'
    | 'caregiver_brief'
    | 'generic_substitution'
    | 'pre_op_cessation'
    | 'pregnancy_lactation'
    | 'travel_timezone';
  title?: string;
  data: {
    symptom?: string;
    medicine_name?: string;
    new_time?: string;
    meal_relation?: string;
    adjustment_reason?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    shiftDetails?: string;
    pillCount?: number;
    dailyDose?: number;
    daysRemaining?: number;
    doctor_name?: string;
    followupDate?: string;
    test_name?: string;
    otc_name?: string;
    safety_grade?: 'safe' | 'caution' | 'prohibited';
    safety_note?: string;
    safe_alternative?: string;
    emergency_title?: string;
    emergency_reasons?: string[];
    // New tools data
    missed_time?: string;
    catchup_instructions?: string;
    do_not_double?: boolean;
    caregiver_message?: string;
    prescribed_brand?: string;
    dispensed_brand?: string;
    generic_name?: string;
    is_equivalent?: boolean;
    procedure_name?: string;
    procedure_date?: string;
    meds_to_stop?: Array<{ name: string; stop_days_before: number; stop_date: string }>;
    pregnancy_category?: string;
    lactation_safety?: string;
    fetal_risk_summary?: string;
    destination_city?: string;
    flight_plan?: Array<{ local_time: string; instruction: string }>;
  };
}

interface ClinicalActionCardsProps {
  action: ClinicalActionCall;
  profileId: string;
  onExecuted?: (message: string) => void;
}

export function ClinicalActionCards({ action, profileId, onExecuted }: ClinicalActionCardsProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>(
    action.data.severity || 'mild'
  );

  // 0. Tool: Adjust Schedule / Food Timing (1-Click Sync)
  if (action.type === 'adjust_schedule') {
    const handleApplySchedule = async () => {
      setIsExecuting(true);
      try {
        const currentMeds = await medicinesRepo.listMedicines(profileId);
        const targetMed = currentMeds.find(
          (m) =>
            m.medicine_name.toLowerCase().includes((action.data.medicine_name || '').toLowerCase()) ||
            (action.data.medicine_name || '').toLowerCase().includes(m.medicine_name.toLowerCase())
        );

        if (targetMed) {
          const isWithFood =
            action.data.meal_relation?.toLowerCase().includes('after') ||
            action.data.meal_relation?.toLowerCase().includes('with');
          await medicinesRepo.updateMedicine(targetMed.id, {
            instructions: `${targetMed.instructions || ''} [Updated schedule: ${action.data.new_time || ''} ${action.data.meal_relation || ''}]`.trim(),
            with_food: isWithFood,
          });
        }
        setIsDone(true);
        if (onExecuted) onExecuted(`Applied schedule adjustment for ${action.data.medicine_name || 'medication'}.`);
      } catch (err) {
        console.error('Failed to update schedule:', err);
      } finally {
        setIsExecuting(false);
      }
    };

    return (
      <div className="my-3 p-3.5 bg-surface-raised border border-accent/30 rounded-2xl shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-content font-bold text-xs flex items-center gap-1.5">
              <ClockIcon size={16} className="text-accent" /> Schedule Optimization Sentinel
            </span>
            <Badge tone="ok" size="sm">1-Click Sync</Badge>
          </div>
          {isDone && (
            <span className="text-2xs text-accent font-bold flex items-center gap-1">
              <CheckIcon size={13} className="text-accent" /> Applied to Timetable
            </span>
          )}
        </div>

        <div className="text-xs space-y-1 text-content">
          <p>
            <strong className="text-content font-bold">Target Medicine:</strong> {action.data.medicine_name}
          </p>
          {action.data.new_time && (
            <p>
              <strong className="text-content font-bold">Recommended Time:</strong> {action.data.new_time}
            </p>
          )}
          {action.data.meal_relation && (
            <p>
              <strong className="text-content font-bold">Food Timing:</strong> {action.data.meal_relation}
            </p>
          )}
          {action.data.adjustment_reason && (
            <p className="text-2xs text-content-muted pt-0.5">
              <span className="font-semibold">Clinical Rationale:</span> {action.data.adjustment_reason}
            </p>
          )}
        </div>

        {!isDone && (
          <div className="pt-2 border-t border-line flex justify-end">
            <Button
              variant="primary"
              size="sm"
              loading={isExecuting}
              onClick={handleApplySchedule}
              className="text-xs font-bold shadow-xs"
              leftIcon={<ClockIcon size={14} />}
            >
              Apply to My Daily Schedule
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 1. Tool: Log Symptom / Adverse Reaction
  if (action.type === 'log_symptom') {
    const handleLogSymptom = async () => {
      setIsExecuting(true);
      try {
        await sideEffectsRepo.createSideEffect({
          user_id: profileId,
          profile_id: profileId,
          medicine_name: action.data.medicine_name || 'General Health Symptom',
          note: action.data.symptom || 'Reported symptom',
          severity: severity,
          occurred_at: new Date().toISOString(),
        });
        setIsDone(true);
        if (onExecuted) onExecuted(`Symptom "${action.data.symptom}" logged to Medical Timeline.`);
      } catch (err) {
        console.error('Failed to log symptom:', err);
      } finally {
        setIsExecuting(false);
      }
    };

    return (
      <div className="my-3 p-3.5 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-900 font-bold text-xs flex items-center gap-1.5">
              <StethoscopeIcon size={16} /> Autonomous Symptom Logger
            </span>
            <Badge tone="warn" size="sm">Triage</Badge>
          </div>
          {isDone && (
            <span className="text-[11px] text-teal-700 font-bold flex items-center gap-1">
              <CheckIcon size={13} className="text-emerald-600" /> Logged to Timeline
            </span>
          )}
        </div>

        <p className="text-xs text-ink-800">
          <strong className="text-ink-900">Symptom:</strong> {action.data.symptom}
          {action.data.medicine_name && (
            <span className="text-ink-500 block text-[11px]">
              Correlated with medication: <strong className="text-teal-900">{action.data.medicine_name}</strong>
            </span>
          )}
        </p>

        {!isDone && (
          <div className="pt-2 border-t border-ink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-ink-500 text-[11px]">Severity:</span>
              {(['mild', 'moderate', 'severe'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-colors ${
                    severity === s
                      ? s === 'severe' ? 'bg-red-500 text-white' : s === 'moderate' ? 'bg-amber-500 text-white' : 'bg-teal-600 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              size="sm"
              loading={isExecuting}
              onClick={handleLogSymptom}
              className="text-xs font-bold shrink-0"
            >
              Confirm Log to Timeline
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 2. Tool: Missed Dose Protocol
  if (action.type === 'missed_dose') {
    return (
      <div className="my-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-950 font-bold text-xs flex items-center gap-1.5">
              <ClockIcon size={16} /> Missed Dose Clinical Safety Protocol
            </span>
            <Badge tone="warn" size="sm">Catch-up</Badge>
          </div>
        </div>

        <p className="text-xs text-ink-900 leading-relaxed">
          {action.data.catchup_instructions || `If your next dose is more than 4 hours away, take your missed dose now. Otherwise, skip it and resume your normal schedule.`}
        </p>

        {action.data.do_not_double && (
          <div className="p-2 rounded-lg bg-red-100 border border-red-200 text-red-950 text-[11px] font-bold flex items-center gap-1.5">
            <AlertTriangleIcon size={14} className="text-red-700 shrink-0" />
            <span>DO NOT DOUBLE UP: Never take two doses together to make up for a missed pill.</span>
          </div>
        )}
      </div>
    );
  }

  // 3. Tool: Caregiver 1-Tap WhatsApp Dispatch
  if (action.type === 'caregiver_brief') {
    const rawMsg = action.data.caregiver_message || 'Medfolio Health Update: Medicines taken on time today.';
    const waUrl = `https://wa.me/?text=${encodeURIComponent(rawMsg)}`;

    return (
      <div className="my-3 p-3.5 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-2.5">
        <Toast open={Boolean(toastMsg)} onClose={() => setToastMsg(null)} message={toastMsg || ''} tone="ok" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-900 font-bold text-xs flex items-center gap-1.5">
              <SparklesIcon size={16} /> Family Caregiver Health Dispatch
            </span>
            <Badge tone="info" size="sm">WhatsApp</Badge>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-ink-50/70 border border-ink-200 font-mono text-[11px] text-ink-800 whitespace-pre-line">
          {rawMsg}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(rawMsg);
              setToastMsg('Message copied to clipboard.');
            }}
            className="text-xs text-ink-600 hover:text-ink-900 font-bold px-2 py-1 flex items-center gap-1"
          >
            <CopyIcon size={13} /> Copy
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <span>Send via WhatsApp</span>
          </a>
        </div>
      </div>
    );
  }

  // 4. Tool: Pharmacy Generic & Brand Substitution Matcher
  if (action.type === 'generic_substitution') {
    const isEq = action.data.is_equivalent ?? true;

    return (
      <div className={`my-3 p-3.5 rounded-2xl border text-xs space-y-2 ${
        isEq ? 'bg-teal-50/60 border-teal-200' : 'bg-amber-50/60 border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-900 flex items-center gap-1.5">
              <MedicineIcon size={16} className="text-purple-700" /> Pharmacy Generic Substitution Audit
            </span>
          </div>
          <Badge tone={isEq ? 'ok' : 'warn'} size="sm">
            {isEq ? 'Bioequivalent Match' : 'Review Formulation'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 bg-white rounded-lg border border-ink-100">
            <span className="text-ink-400 block text-[10px]">Prescribed Brand:</span>
            <span className="font-bold text-ink-900">{action.data.prescribed_brand}</span>
          </div>
          <div className="p-2 bg-white rounded-lg border border-ink-100">
            <span className="text-ink-400 block text-[10px]">Dispensed Alternative:</span>
            <span className="font-bold text-teal-900">{action.data.dispensed_brand}</span>
          </div>
        </div>

        <p className="text-ink-700 text-[11px] leading-relaxed">
          Active Chemical Salt: <strong className="text-ink-900">{action.data.generic_name}</strong>. {action.data.safety_note || 'Both brands contain the identical active pharmacological molecule and therapeutic strength.'}
        </p>
      </div>
    );
  }

  // 5. Tool: Pre-Surgery / Dental Extraction Cessation Audit
  if (action.type === 'pre_op_cessation') {
    return (
      <div className="my-3 p-3.5 bg-red-50/60 border border-red-200 rounded-2xl shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-950 font-bold text-xs flex items-center gap-1.5">
              <AlertTriangleIcon size={16} className="text-red-700" /> Pre-Procedure Medication Cessation Audit
            </span>
            <Badge tone="risk" size="sm">Pre-Op</Badge>
          </div>
        </div>

        <p className="text-xs text-ink-800">
          Upcoming Procedure: <strong className="text-ink-900">{action.data.procedure_name || 'Surgery / Dental Procedure'}</strong>
          {action.data.procedure_date && ` (${action.data.procedure_date})`}
        </p>

        {action.data.meds_to_stop && action.data.meds_to_stop.length > 0 && (
          <div className="space-y-1.5">
            {action.data.meds_to_stop.map((m, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-white border border-red-200 text-[11px] flex justify-between items-center">
                <div>
                  <span className="font-bold text-red-900 block">{m.name}</span>
                  <span className="text-ink-500 text-[10px]">Stop {m.stop_days_before} days before surgery</span>
                </div>
                <Badge tone="risk" size="sm">Stop by {m.stop_date}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 6. Tool: Pregnancy & Lactation Safety Index
  if (action.type === 'pregnancy_lactation') {
    const cat = action.data.pregnancy_category || 'Category B';
    const isSafe = cat.includes('A') || cat.includes('B');

    return (
      <div className={`my-3 p-3.5 rounded-2xl border text-xs space-y-2 ${
        isSafe ? 'bg-teal-50/60 border-teal-200' : 'bg-red-50/60 border-red-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-900 flex items-center gap-1.5">
              <MedicineIcon size={16} className="text-purple-700" /> Maternal & Fetal Safety: {action.data.medicine_name}
            </span>
          </div>
          <Badge tone={isSafe ? 'ok' : 'risk'} size="sm">{cat}</Badge>
        </div>

        <div className="text-[11px] space-y-1 text-ink-800 leading-relaxed">
          <p>{action.data.fetal_risk_summary}</p>
          {action.data.lactation_safety && (
            <p className="text-teal-900 font-medium">LactMed / Nursing: {action.data.lactation_safety}</p>
          )}
        </div>
      </div>
    );
  }

  // 7. Tool: Flight & Timezone Chrono-Shift Planner
  if (action.type === 'travel_timezone') {
    return (
      <div className="my-3 p-3.5 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-900 font-bold text-xs flex items-center gap-1.5">
              <ClockIcon size={16} /> Flight Timezone Chrono-Shift Planner
            </span>
            <Badge tone="info" size="sm">{action.data.destination_city || 'Travel'}</Badge>
          </div>
        </div>

        {action.data.flight_plan && (
          <div className="space-y-1.5">
            {action.data.flight_plan.map((step, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-ink-50/60 border border-ink-100 text-[11px] flex items-center gap-2">
                <span className="font-mono font-bold text-teal-800 shrink-0">{step.local_time}</span>
                <span className="text-ink-800">{step.instruction}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 8. Tool: Doctor & Lab Follow-up Scheduler
  if (action.type === 'schedule_followup') {
    const handleSchedule = async () => {
      setIsExecuting(true);
      const today = todayInAppTz();
      const targetDate = action.data.followupDate || addDaysAppTz(today, 14);

      try {
        if (action.data.test_name) {
          await testOrdersRepo.createTestOrder({
            user_id: profileId,
            profile_id: profileId,
            test_name: action.data.test_name,
            ordered_date: today,
            status: 'pending',
          });
        } else {
          await visitsRepo.createVisit({
            user_id: profileId,
            profile_id: profileId,
            doctor_name: action.data.doctor_name || 'Physician',
            visit_date: targetDate,
            diagnosis: 'Follow-up Consultation',
          });
        }
        setIsDone(true);
        if (onExecuted) onExecuted('Follow-up reminder recorded.');
      } catch (err) {
        console.error('Failed to create reminder:', err);
      } finally {
        setIsExecuting(false);
      }
    };

    return (
      <div className="my-3 p-3.5 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-900 font-bold text-xs flex items-center gap-1.5">
              <CalendarDaysIcon size={16} /> Clinical Follow-up Tracker
            </span>
            <Badge tone="info" size="sm">Calendar</Badge>
          </div>
          {isDone && (
            <span className="text-[11px] text-teal-700 font-bold flex items-center gap-1">
              <CheckIcon size={13} className="text-emerald-600" /> Scheduled
            </span>
          )}
        </div>

        <p className="text-xs text-ink-800">
          {action.data.test_name ? (
            <>Repeat diagnostic test: <strong className="text-ink-900">{action.data.test_name}</strong></>
          ) : (
            <>Doctor consultation: <strong className="text-ink-900">Dr. {action.data.doctor_name || 'Physician'}</strong></>
          )}
          {action.data.followupDate && (
            <span className="text-teal-900 block font-medium mt-0.5">Target Date: {action.data.followupDate}</span>
          )}
        </p>

        {!isDone && (
          <div className="pt-2 border-t border-ink-100 flex justify-end">
            <Button
              variant="primary"
              size="sm"
              loading={isExecuting}
              onClick={handleSchedule}
              className="text-xs font-bold"
              leftIcon={<CalendarDaysIcon size={14} />}
            >
              Set Follow-up Reminder
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 9. Tool: Smart Refill Depletion Alert
  if (action.type === 'create_refill') {
    const days = action.data.daysRemaining || 7;

    return (
      <div className="my-3 p-3.5 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-teal-900 font-bold text-xs flex items-center gap-1.5">
              <MedicineIcon size={16} className="text-teal-700" /> Pill Supply & Refill Predictor
            </span>
            <Badge tone={days <= 3 ? 'risk' : 'ok'} size="sm">
              {days} Days Left
            </Badge>
          </div>
        </div>

        <p className="text-xs text-ink-700">
          Based on your dosage, your pack of <strong className="text-ink-900">{action.data.medicine_name}</strong> will run out in <strong>{days} days</strong>.
        </p>

        <div className="pt-1 flex items-center justify-between text-xs">
          <span className="text-[11px] text-ink-500">Refill Reminder Alert active</span>
          <Link to="/medicines/cabinet" className="text-xs text-teal-800 font-bold hover:underline">
            Manage Cabinet &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // 10. Tool: Instant OTC Compatibility Meter
  if (action.type === 'otc_compatibility') {
    const grade = action.data.safety_grade || 'caution';
    const badgeTone = grade === 'safe' ? 'ok' : grade === 'prohibited' ? 'risk' : 'warn';
    const gradeText = grade === 'safe' ? 'Compatible' : grade === 'prohibited' ? 'Contraindicated (Dangerous)' : 'Caution Required';

    return (
      <div className={`my-3 p-3.5 rounded-2xl border text-xs space-y-2 ${
        grade === 'prohibited'
          ? 'bg-red-50/60 border-red-200'
          : grade === 'safe'
          ? 'bg-teal-50/60 border-teal-200'
          : 'bg-amber-50/60 border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-900 flex items-center gap-1.5">
              <MedicineIcon size={16} /> OTC Safety Checker: {action.data.otc_name}
            </span>
          </div>
          <Badge tone={badgeTone} size="sm">{gradeText}</Badge>
        </div>

        {action.data.safety_note && (
          <p className="text-ink-800 text-[11px] leading-relaxed">
            {action.data.safety_note}
          </p>
        )}

        {action.data.safe_alternative && (
          <div className="p-2 rounded-lg bg-white border border-ink-200/80 text-[11px] flex items-center gap-1.5">
            <SparklesIcon size={14} className="text-teal-700 shrink-0" />
            <div>
              <span className="font-bold text-teal-900">Recommended Safe Alternative: </span>
              <span className="text-ink-800">{action.data.safe_alternative}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 11. Tool: Emergency Triage Card
  if (action.type === 'emergency_triage') {
    return (
      <div className="my-3 p-4 bg-red-900 text-white rounded-2xl shadow-lg space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <EmergencyAmbulanceIcon size={24} />
          </div>
          <div>
            <h4 className="font-black text-sm text-red-100">EMERGENCY CLINICAL RED FLAG DETECTED</h4>
            <p className="text-xs text-red-200">Immediate emergency evaluation required. Do not delay.</p>
          </div>
        </div>

        {action.data.emergency_reasons && (
          <ul className="list-disc list-inside text-xs text-red-100 space-y-0.5">
            {action.data.emergency_reasons.map((r, rIdx) => (
              <li key={rIdx}>{r}</li>
            ))}
          </ul>
        )}

        <div className="pt-2 border-t border-red-700/80 grid grid-cols-3 gap-2">
          <a
            href="tel:1122"
            className="p-2 rounded-xl bg-red-800 hover:bg-red-700 text-center font-bold text-xs text-white border border-red-500 transition-all flex flex-col items-center gap-1"
          >
            <EmergencyAmbulanceIcon size={18} />
            <span>Rescue 1122</span>
          </a>
          <a
            href="tel:115"
            className="p-2 rounded-xl bg-red-800 hover:bg-red-700 text-center font-bold text-xs text-white border border-red-500 transition-all flex flex-col items-center gap-1"
          >
            <HospitalIcon size={18} />
            <span>Edhi 115</span>
          </a>
          <a
            href="tel:1020"
            className="p-2 rounded-xl bg-red-800 hover:bg-red-700 text-center font-bold text-xs text-white border border-red-500 transition-all flex flex-col items-center gap-1"
          >
            <EmergencyAmbulanceIcon size={18} />
            <span>Chhipa 1020</span>
          </a>
        </div>
      </div>
    );
  }

  return null;
}
