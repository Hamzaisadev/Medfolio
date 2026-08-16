import { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { MedicineRecord } from '../../domain/activeMedicines';

interface DrugInteractionRadarProps {
  medicines: MedicineRecord[];
  allergies?: string | null;
  chronicConditions?: string | null;
  onAskAssistant?: (query: string) => void;
}

export function DrugInteractionRadar({
  medicines,
  allergies,
  chronicConditions,
  onAskAssistant,
}: DrugInteractionRadarProps) {
  const [selectedOtc, setSelectedOtc] = useState<string | null>(null);

  const activeNames = medicines.map((m) => m.medicine_name.toLowerCase());

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
  ];

  const relevantFoodRules = knownFoodRules.filter((r) =>
    r.appliesTo.some((drug) => activeNames.some((m) => m.includes(drug)))
  );

  const otcChecklist = [
    {
      name: 'Brufen / Ibuprofen / NSAIDs',
      category: 'Pain & Inflammation',
      isSafe: !chronicConditions?.toLowerCase().includes('hypertension') && !chronicConditions?.toLowerCase().includes('kidney'),
      note: 'Can increase blood pressure, reduce kidney filtration, and blunt the effect of antihypertensive medications like Amlodipine or ACE-inhibitors.',
    },
    {
      name: 'Panadol / Paracetamol',
      category: 'Fever & Mild Pain',
      isSafe: true,
      note: 'Generally the safest pain reliever for individuals with hypertension or kidney disease. Maintain maximum 3g-4g daily limit.',
    },
    {
      name: 'Antacids (Mucaine / Eno / Gaviscon)',
      category: 'Acidity & Reflux',
      isSafe: true,
      note: 'Separate by at least 2 hours from your other medications to prevent impaired drug absorption in the stomach.',
    },
    {
      name: 'Disprin / Aspirin',
      category: 'Blood Thinner / Pain',
      isSafe: !allergies?.toLowerCase().includes('aspirin'),
      note: 'Consult your physician before taking routine aspirin if you are already on cardiac medications.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Status Banner */}
      <div className="p-4 rounded-2xl bg-teal-900 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
            <h3 className="font-bold text-sm">Active Drug Interaction Scanner</h3>
          </div>
          <p className="text-xs text-teal-200">
            Scanning {medicines.length} active prescriptions against food rules, allergies, and OTC remedies.
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
                    <p className="text-ink-600 mt-1">
                      {m.with_food ? '🍽️ Take with or after meals' : '⏳ Take on empty stomach (or as directed)'}
                    </p>
                    {m.instructions && <p className="text-ink-500 text-[11px] mt-0.5">{m.instructions}</p>}
                  </div>

                  <Badge tone={m.with_food ? 'info' : 'neutral'} size="sm">
                    {m.frequency_code || 'Daily'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Dietary & Food Interactions */}
        <Card header={<h3 className="text-sm font-bold text-ink-900">Food & Dietary Precautions</h3>}>
          {relevantFoodRules.length === 0 ? (
            <div className="p-4 text-center text-xs text-ink-500 bg-ink-50 rounded-xl">
              No critical food-drug contraindications detected for your current prescriptions.
            </div>
          ) : (
            <div className="space-y-3">
              {relevantFoodRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950">{rule.food}</span>
                    <Badge tone="warn" size="sm">Caution</Badge>
                  </div>
                  <p className="text-amber-900 text-[11px] leading-relaxed">{rule.rule}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Common OTC Medicine Safety Guide */}
      <Card header={<h3 className="text-sm font-bold text-ink-900">Over-The-Counter (OTC) Medicine Safety Radar</h3>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {otcChecklist.map((otc, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                selectedOtc === otc.name ? 'border-teal-600 bg-teal-50/50' : 'border-ink-200 bg-white hover:border-ink-300'
              }`}
              onClick={() => setSelectedOtc(selectedOtc === otc.name ? null : otc.name)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-ink-900">{otc.name}</span>
                <Badge tone={otc.isSafe ? 'ok' : 'risk'} size="sm">
                  {otc.isSafe ? 'Low Risk' : 'Check Doctor'}
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
