import { useState } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { medicinesRepo, dosesRepo } from '../../lib/db';
import { parseFrequency, defaultDoseTimes } from '../../domain/frequency';
import { buildSchedule } from '../../domain/schedule';
import { todayInAppTz, addDaysAppTz } from '../../lib/time';

export interface ExtractedMedItem {
  medicine_name: string;
  strength?: string;
  frequency_code?: string;
  duration_days?: number;
  with_food?: boolean;
  instructions?: string;
}

interface EditablePrescriptionWidgetProps {
  initialMedicines: ExtractedMedItem[];
  profileId: string;
  onAddedSuccess?: (count: number) => void;
}

export function EditablePrescriptionWidget({
  initialMedicines,
  profileId,
  onAddedSuccess,
}: EditablePrescriptionWidgetProps) {
  const [items, setItems] = useState<ExtractedMedItem[]>(initialMedicines);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleFieldChange = (index: number, field: keyof ExtractedMedItem, val: unknown) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, [field]: val } as ExtractedMedItem;
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        medicine_name: 'New Medicine',
        strength: '500mg',
        frequency_code: 'BD',
        duration_days: 5,
        with_food: true,
      },
    ]);
  };

  const handleSaveToTimetable = async () => {
    if (items.length === 0 || isSaving || isSaved) return;

    setIsSaving(true);
    const today = todayInAppTz();

    try {
      for (const item of items) {
        const duration = Number(item.duration_days) || 7;
        const endDate = addDaysAppTz(today, duration);
        const freqCode = parseFrequency(item.frequency_code) || 'OD';
        const withFood = item.with_food ?? true;

        // 1. Create Medicine Record in Cabinet
        const createdMed = await medicinesRepo.createMedicine({
          user_id: profileId,
          profile_id: profileId,
          medicine_name: item.medicine_name,
          strength: item.strength || null,
          frequency_raw: item.frequency_code || null,
          frequency_code: freqCode,
          start_date: today,
          end_date: endDate,
          duration_days: duration,
          is_ongoing: false,
          with_food: withFood,
          instructions: item.instructions || null,
        });

        // 2. Generate Scheduled Dose Slots for Timetable & Today Schedule
        const defaultTimes = defaultDoseTimes(freqCode, withFood, item.frequency_code);
        if (freqCode !== 'PRN' && freqCode !== 'SOS' && defaultTimes.length > 0) {
          const doseRows = buildSchedule({
            medicineId: createdMed.id,
            startDate: today,
            durationDays: duration,
            isOngoing: false,
            doseTimes: defaultTimes,
            now: new Date(),
          });

          if (doseRows.length > 0) {
            await dosesRepo.createDoses(
              doseRows.map((d) => ({
                user_id: profileId,
                profile_id: profileId,
                medicine_id: createdMed.id,
                scheduled_date: d.scheduled_date,
                scheduled_minutes: d.scheduled_minutes,
                status: 'pending',
              }))
            );
          }
        }
      }

      setIsSaved(true);
      if (onAddedSuccess) {
        onAddedSuccess(items.length);
      }
    } catch (err) {
      console.error('Failed to add medicines to cabinet & timetable:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="my-3 p-3.5 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-900 font-bold text-xs">📋 Detected Prescribed Medicines</span>
          <Badge tone="ok" size="sm">{items.length} detected</Badge>
        </div>

        {isSaved ? (
          <span className="text-xs font-bold text-teal-700">✅ Added to Cabinet & Timetable</span>
        ) : (
          <span className="text-[11px] text-ink-500">Edit fields before adding to timetable</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-ink-200 text-ink-500 text-[11px]">
              <th className="pb-1.5 font-bold">Medicine</th>
              <th className="pb-1.5 font-bold">Strength</th>
              <th className="pb-1.5 font-bold">Frequency</th>
              <th className="pb-1.5 font-bold">Days</th>
              <th className="pb-1.5 font-bold">Timing</th>
              <th className="pb-1.5 font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {items.map((med, idx) => (
              <tr key={idx} className="hover:bg-ink-50/50">
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={med.medicine_name}
                    disabled={isSaved}
                    onChange={(e) => handleFieldChange(idx, 'medicine_name', e.target.value)}
                    className="w-full font-bold text-ink-900 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={med.strength || ''}
                    disabled={isSaved}
                    placeholder="e.g. 500mg"
                    onChange={(e) => handleFieldChange(idx, 'strength', e.target.value)}
                    className="w-20 text-ink-700 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={med.frequency_code || ''}
                    disabled={isSaved}
                    placeholder="e.g. 1-0-1"
                    onChange={(e) => handleFieldChange(idx, 'frequency_code', e.target.value)}
                    className="w-20 text-ink-700 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    value={med.duration_days || 5}
                    disabled={isSaved}
                    onChange={(e) => handleFieldChange(idx, 'duration_days', parseInt(e.target.value) || 1)}
                    className="w-12 text-ink-700 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    value={med.with_food ? 'after' : 'before'}
                    disabled={isSaved}
                    onChange={(e) => handleFieldChange(idx, 'with_food', e.target.value === 'after')}
                    className="text-[11px] bg-transparent border border-ink-200 rounded px-1 py-0.5 focus:outline-none focus:border-teal-500"
                  >
                    <option value="after">After Food</option>
                    <option value="before">Empty Stomach</option>
                  </select>
                </td>
                <td className="py-1.5 text-right">
                  {!isSaved && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="text-ink-400 hover:text-red-600 text-xs px-1 font-bold"
                      title="Remove medicine"
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-2 border-t border-ink-100 flex items-center justify-between gap-2">
        {!isSaved ? (
          <>
            <button
              type="button"
              onClick={handleAddRow}
              className="text-xs text-teal-800 hover:text-teal-950 font-bold"
            >
              + Add another medicine
            </button>
            <Button
              variant="primary"
              size="sm"
              loading={isSaving}
              onClick={handleSaveToTimetable}
              className="font-bold text-xs shadow-xs"
            >
              ➕ Add all to Medication Cabinet & Timetable
            </Button>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <span className="text-xs text-teal-800 font-semibold">
              Added to your daily schedule & timetable.
            </span>
            <a
              href="/schedule"
              className="text-xs font-bold text-teal-900 hover:underline flex items-center gap-1"
            >
              <span>View Today's Schedule</span>
              <span>&rarr;</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
