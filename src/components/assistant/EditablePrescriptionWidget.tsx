import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { medicinesRepo, dosesRepo } from '../../lib/db';
import { parseFrequency, defaultDoseTimes } from '../../domain/frequency';
import { buildSchedule } from '../../domain/schedule';
import { computeEndDate } from '../../domain/duration';
import { todayInAppTz } from '../../lib/time';
import { newId } from '../../lib/db/localStore';

/** Used when a row has no duration set, and shown in the UI as the same number. */
const DEFAULT_DURATION_DAYS = 5;

export interface ExtractedMedItem {
  medicine_name: string;
  strength?: string;
  /**
   * Frequency exactly as written (e.g. "1-0-1", "BD", "PRN"). Named `_raw`
   * because it is free text the app parses — not the `frequency_code` enum.
   */
  frequency_raw?: string;
  duration_days?: number;
  /** null = the prescription did not state a meal relation. */
  with_food?: boolean | null;
  instructions?: string;
}

interface EditablePrescriptionWidgetProps {
  initialMedicines: ExtractedMedItem[];
  profileId: string;
  /** Owning auth user. Distinct from profileId so family profiles save correctly. */
  userId: string;
  onAddedSuccess?: (count: number) => void;
}

/** A draft row: the extracted item plus a stable key for React. */
type DraftRow = ExtractedMedItem & { rowId: string };

export function EditablePrescriptionWidget({
  initialMedicines,
  profileId,
  userId,
  onAddedSuccess,
}: EditablePrescriptionWidgetProps) {
  // Rows carry a stable id so React keys survive reordering and removal; with
  // `key={idx}` an edit could be applied to the wrong row after a delete.
  const [items, setItems] = useState<DraftRow[]>(() =>
    initialMedicines.map((m) => ({ ...m, rowId: newId() }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleFieldChange = (rowId: string, field: keyof ExtractedMedItem, val: unknown) => {
    setItems((prev) =>
      prev.map((row) => (row.rowId === rowId ? ({ ...row, [field]: val } as DraftRow) : row))
    );
  };

  const handleRemoveRow = (rowId: string) => {
    setItems((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        rowId: newId(),
        medicine_name: '',
        strength: '',
        frequency_raw: '',
        duration_days: DEFAULT_DURATION_DAYS,
        with_food: true,
      },
    ]);
  };

  const handleSaveToTimetable = async () => {
    if (items.length === 0 || isSaving || isSaved) return;

    setSaveError(null);
    const today = todayInAppTz();

    // Frequency is never guessed: an unreadable value would otherwise be saved
    // as once-daily, under-dosing a BD or TDS course.
    const unreadable = items.filter((item) => !parseFrequency(item.frequency_raw));
    if (unreadable.length > 0) {
      setSaveError(
        `Set a readable frequency (e.g. 1-0-1, BD, TDS, PRN) for: ${unreadable
          .map((i) => i.medicine_name || 'unnamed medicine')
          .join(', ')}.`
      );
      return;
    }

    const unnamed = items.some((item) => !item.medicine_name.trim());
    if (unnamed) {
      setSaveError('Every row needs a medicine name.');
      return;
    }

    setIsSaving(true);

    try {
      for (const item of items) {
        const duration = Number(item.duration_days) || DEFAULT_DURATION_DAYS;
        // end_date = start + days - 1, matching computeEndDate's documented rule.
        // Using `start + days` made every course a day too long.
        const endDate = computeEndDate(today, duration);
        const freqCode = parseFrequency(item.frequency_raw)!;
        const withFood = item.with_food ?? null;

        // 1. Create Medicine Record in Cabinet
        const createdMed = await medicinesRepo.createMedicine({
          user_id: userId,
          profile_id: profileId,
          medicine_name: item.medicine_name.trim(),
          strength: item.strength || null,
          frequency_raw: item.frequency_raw || null,
          frequency_code: freqCode,
          start_date: today,
          end_date: endDate,
          duration_days: duration,
          is_ongoing: false,
          with_food: withFood,
          instructions: item.instructions || null,
        });

        // 2. Generate Scheduled Dose Slots for Timetable & Today Schedule
        const defaultTimes = defaultDoseTimes(freqCode, withFood, item.frequency_raw);
        if (defaultTimes.length > 0) {
          const doseRows = buildSchedule({
            medicineId: createdMed.id,
            startDate: today,
            durationDays: duration,
            isOngoing: false,
            doseTimes: defaultTimes,
            now: new Date(),
            frequencyCode: freqCode,
          });

          if (doseRows.length > 0) {
            await dosesRepo.createDoses(
              doseRows.map((d) => ({
                user_id: userId,
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
      setSaveError(
        err instanceof Error
          ? `Could not save: ${err.message}`
          : 'Could not save these medicines. Please try again.'
      );
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

      {saveError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
          {saveError}
        </div>
      )}

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
            {items.map((med) => (
              <tr key={med.rowId} className="hover:bg-ink-50/50">
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={med.medicine_name}
                    disabled={isSaved}
                    placeholder="Medicine name"
                    onChange={(e) => handleFieldChange(med.rowId, 'medicine_name', e.target.value)}
                    className="w-full font-bold text-ink-900 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={med.strength || ''}
                    disabled={isSaved}
                    placeholder="e.g. 500mg"
                    onChange={(e) => handleFieldChange(med.rowId, 'strength', e.target.value)}
                    className="w-20 text-ink-700 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="text"
                    value={med.frequency_raw || ''}
                    disabled={isSaved}
                    placeholder="e.g. 1-0-1"
                    onChange={(e) => handleFieldChange(med.rowId, 'frequency_raw', e.target.value)}
                    className={`w-20 bg-transparent border-b focus:border-teal-500 focus:outline-none ${
                      med.frequency_raw && !parseFrequency(med.frequency_raw)
                        ? 'border-amber-500 text-amber-800'
                        : 'border-transparent text-ink-700'
                    }`}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    min={1}
                    // Shows the same number that will be saved; the UI previously
                    // displayed 5 while the save path used 7.
                    value={med.duration_days ?? DEFAULT_DURATION_DAYS}
                    disabled={isSaved}
                    onChange={(e) =>
                      handleFieldChange(
                        med.rowId,
                        'duration_days',
                        Math.max(1, parseInt(e.target.value, 10) || DEFAULT_DURATION_DAYS)
                      )
                    }
                    className="w-12 text-ink-700 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    value={
                      med.with_food === true ? 'after' : med.with_food === false ? 'before' : 'unknown'
                    }
                    disabled={isSaved}
                    onChange={(e) =>
                      handleFieldChange(
                        med.rowId,
                        'with_food',
                        e.target.value === 'after' ? true : e.target.value === 'before' ? false : null
                      )
                    }
                    className="text-[11px] bg-transparent border border-ink-200 rounded px-1 py-0.5 focus:outline-none focus:border-teal-500"
                  >
                    <option value="unknown">Not specified</option>
                    <option value="after">After Food</option>
                    <option value="before">Empty Stomach</option>
                  </select>
                </td>
                <td className="py-1.5 text-right">
                  {!isSaved && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(med.rowId)}
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
            {/* `/schedule` was not a registered route (404), and a raw anchor
                forced a full page reload. */}
            <Link
              to="/medicines"
              className="text-xs font-bold text-teal-900 hover:underline flex items-center gap-1"
            >
              <span>View Today's Schedule</span>
              <span>&rarr;</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
