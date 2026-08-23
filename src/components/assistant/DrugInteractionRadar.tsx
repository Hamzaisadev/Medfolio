import { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { mealRelationInstruction } from '../../domain/mealRelation';
import type { MedicineRecord } from '../../domain/activeMedicines';

interface DrugInteractionRadarProps {
  medicines: MedicineRecord[];
  allergies?: string | null;
  chronicConditions?: string | null;
  onAskAssistant?: (query: string) => void;
}

/**
 * Food and OTC guidance for the patient's active medicines.
 *
 * Scope note, because this used to overstate itself: these are a small set of
 * hardcoded rules, NOT a drug-interaction database. It cannot detect drug-drug
 * interactions, so it must never tell the patient their combination is safe —
 * absence of a matching rule means "not checked", and the copy below says so.
 */
export function DrugInteractionRadar({
  medicines,
  allergies,
  chronicConditions,
  onAskAssistant,
}: DrugInteractionRadarProps) {
  const [selectedOtc, setSelectedOtc] = useState<string | null>(null);

  const activeNames = medicines.map((m) => m.medicine_name.toLowerCase());
  const matchesAny = (needles: string[]) =>
    needles.some((drug) => activeNames.some((m) => m.includes(drug)));

  // Known clinical interaction patterns common in Pakistani clinical practice
  const knownFoodRules = [
    {
      food: 'Grapefruit & Grapefruit Juice',
      appliesTo: ['amlodipine', 'atorvastatin', 'lipiget', 'simvastatin', 'nifedipine'],
      severity: 'risk',
      rule: 'Avoid grapefruit completely. It blocks liver enzymes (CYP3A4), causing drug levels to spike and triggering severe hypotension or muscle aches.',
    },
    {
      food: 'High Dairy / Calcium / Milk',
      appliesTo: ['ciprofloxacin', 'doxycycline', 'tetracycline', 'levofloxacin', 'leflox'],
      severity: 'warn',
      rule: 'Take 2 hours before or 4 hours after dairy products. Calcium binds to these antibiotics and blocks absorption.',
    },
    {
      food: 'High Potassium Foods (Bananas, Salt Substitutes)',
      appliesTo: ['ramipril', 'lisinopril', 'losartan', 'spironolactone', 'zestril', 'cozaar'],
      severity: 'warn',
      rule: 'Consume in moderation. ACE-inhibitors and ARBs conserve potassium in your blood.',
    },
    {
      food: 'Vitamin K Foods (Spinach, Kale, Green Tea)',
      appliesTo: ['warfarin', 'acitrom', 'nicoumalone', 'coumadin'],
      severity: 'risk',
      rule: 'Keep your intake of leafy greens steady rather than avoiding them — sudden changes swing your INR. Never start a new supplement without telling your doctor.',
    },
  ];

  const relevantFoodRules = knownFoodRules.filter((r) => matchesAny(r.appliesTo));

  // Drug classes where an OTC choice is materially riskier. Checked against the
  // active medicine list, not only the chronic-conditions free text — a patient
  // on an ACE-inhibitor or an anticoagulant needs the warning either way.
  const onAnticoagulant = matchesAny([
    'warfarin', 'acitrom', 'nicoumalone', 'coumadin', 'clopidogrel', 'plavix',
    'apixaban', 'eliquis', 'rivaroxaban', 'xarelto', 'heparin', 'enoxaparin', 'clexane',
  ]);
  const onBpMedicine = matchesAny([
    'ramipril', 'lisinopril', 'enalapril', 'losartan', 'valsartan', 'telmisartan',
    'amlodipine', 'bisoprolol', 'atenolol', 'carvedilol', 'furosemide', 'lasix',
    'hydrochlorothiazide', 'spironolactone', 'zestril', 'cozaar',
  ]);
  const conditionText = chronicConditions?.toLowerCase() ?? '';
  const allergyText = allergies?.toLowerCase() ?? '';
  const hasRenalOrBpCondition =
    conditionText.includes('hypertension') ||
    conditionText.includes('kidney') ||
    conditionText.includes('renal');

  const otcChecklist: Array<{
    name: string;
    category: string;
    risk: 'caution' | 'usually_ok';
    note: string;
  }> = [
    {
      name: 'Brufen / Ibuprofen / NSAIDs',
      category: 'Pain & Inflammation',
      risk: hasRenalOrBpCondition || onBpMedicine || onAnticoagulant ? 'caution' : 'usually_ok',
      note: onAnticoagulant
        ? 'You are on a blood thinner. NSAIDs raise bleeding risk substantially — ask your doctor before taking any.'
        : 'Can increase blood pressure, reduce kidney filtration, and blunt the effect of antihypertensive medications like Amlodipine or ACE-inhibitors.',
    },
    {
      name: 'Panadol / Paracetamol',
      category: 'Fever & Mild Pain',
      risk: conditionText.includes('liver') ? 'caution' : 'usually_ok',
      note: conditionText.includes('liver')
        ? 'Usually the safest pain reliever, but with liver disease the safe daily maximum is lower — confirm your limit with your doctor.'
        : 'Generally the safest pain reliever for individuals with hypertension or kidney disease. Maintain maximum 3g-4g daily limit.',
    },
    {
      name: 'Antacids (Mucaine / Eno / Gaviscon)',
      category: 'Acidity & Reflux',
      risk: 'usually_ok',
      note: 'Separate by at least 2 hours from your other medications to prevent impaired drug absorption in the stomach.',
    },
    {
      name: 'Disprin / Aspirin',
      category: 'Blood Thinner / Pain',
      risk: allergyText.includes('aspirin') || onAnticoagulant ? 'caution' : 'usually_ok',
      note: allergyText.includes('aspirin')
        ? 'Your record lists an aspirin allergy. Do not take this without speaking to your doctor.'
        : onAnticoagulant
          ? 'You are already on a blood thinner. Adding aspirin materially increases bleeding risk — doctor first.'
          : 'Consult your physician before taking routine aspirin if you are already on cardiac medications.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Status Banner */}
      <div className="p-4 rounded-2xl bg-teal-900 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
            <h3 className="font-bold text-sm">Food & OTC Guidance</h3>
          </div>
          <p className="text-xs text-teal-200">
            Checking {medicines.length} active medicine{medicines.length === 1 ? '' : 's'} against
            common food rules, your allergies, and everyday over-the-counter remedies.
          </p>
        </div>

        {onAskAssistant && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onAskAssistant(
                `Please perform a comprehensive drug-drug and food interaction check for all my active medications: ${medicines.map((m) => m.medicine_name).join(', ')}.`
              )
            }
          >
            Run Deep Analysis &rarr;
          </Button>
        )}
      </div>

      {/* Scope disclosure. This screen cannot detect drug-drug interactions, so
          it says that plainly rather than implying a clean bill of health. */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 leading-relaxed">
        <strong className="font-bold">This is not a full interaction check.</strong> These are
        general food and OTC rules — they do not cover interactions between your prescribed
        medicines. Always confirm combinations with your doctor or pharmacist.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Prescriptions Timing & Separation */}
        <Card header={<h3 className="text-sm font-bold text-ink-900">Medication Timetable & Meal Rules</h3>}>
          {medicines.length === 0 ? (
            <p className="text-xs text-ink-400 italic py-4 text-center">No active medications recorded.</p>
          ) : (
            <div className="space-y-3">
              {medicines.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl border border-ink-100 bg-ink-50/50 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink-900">{m.medicine_name}</span>
                      {m.strength && <Badge tone="neutral" size="sm">{m.strength}</Badge>}
                    </div>
                    <p className="text-ink-600 mt-1">{mealRelationInstruction(m.with_food)}</p>
                    {m.instructions && <p className="text-ink-500 text-[11px] mt-0.5">{m.instructions}</p>}
                  </div>

                  <Badge tone={m.with_food === true ? 'info' : 'neutral'} size="sm">
                    {m.frequency_raw || m.frequency_code || 'Not recorded'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Dietary & Food Interactions */}
        <Card header={<h3 className="text-sm font-bold text-ink-900">Food & Dietary Precautions</h3>}>
          {relevantFoodRules.length === 0 ? (
            <div className="p-4 text-xs text-ink-600 bg-ink-50 rounded-xl leading-relaxed">
              None of our food-interaction rules apply to your current medicines.{' '}
              <span className="text-ink-500">
                That is not the same as a clean interaction check — use Run Deep Analysis, or ask your
                pharmacist, for a full review.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {relevantFoodRules.map((rule) => (
                <div
                  key={rule.food}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    rule.severity === 'risk'
                      ? 'border-rose-200 bg-rose-50/60'
                      : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={rule.severity === 'risk' ? 'font-bold text-rose-950' : 'font-bold text-amber-950'}>
                      {rule.food}
                    </span>
                    <Badge tone={rule.severity === 'risk' ? 'risk' : 'warn'} size="sm">
                      {rule.severity === 'risk' ? 'Avoid' : 'Caution'}
                    </Badge>
                  </div>
                  <p
                    className={`text-[11px] leading-relaxed ${
                      rule.severity === 'risk' ? 'text-rose-900' : 'text-amber-900'
                    }`}
                  >
                    {rule.rule}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Common OTC Medicine Safety Guide */}
      <Card header={<h3 className="text-sm font-bold text-ink-900">Over-The-Counter (OTC) Medicine Guidance</h3>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {otcChecklist.map((otc) => (
            <div
              key={otc.name}
              role="button"
              tabIndex={0}
              aria-pressed={selectedOtc === otc.name}
              className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                selectedOtc === otc.name ? 'border-teal-600 bg-teal-50/50' : 'border-ink-200 bg-white hover:border-ink-300'
              }`}
              onClick={() => setSelectedOtc(selectedOtc === otc.name ? null : otc.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedOtc(selectedOtc === otc.name ? null : otc.name);
                }
              }}
            >
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <span className="font-bold text-ink-900">{otc.name}</span>
                {/* "Usually OK" rather than "Low Risk": this screen has not
                    verified the patient's full medicine list. */}
                <Badge tone={otc.risk === 'caution' ? 'risk' : 'neutral'} size="sm">
                  {otc.risk === 'caution' ? 'Ask your doctor' : 'Usually OK'}
                </Badge>
              </div>
              <span className="text-[10px] text-ink-500 block mb-1">{otc.category}</span>
              <p className="text-ink-600 text-[11px] leading-relaxed">{otc.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
