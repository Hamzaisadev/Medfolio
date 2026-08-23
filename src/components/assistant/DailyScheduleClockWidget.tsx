import { useState } from 'react';
import { Badge } from '../ui/Badge';
import {
  SunriseIcon,
  SunIcon,
  SunsetIcon,
  MoonIcon,
  ClockIcon,
  MealIcon,
  CheckIcon,
} from '../ui/icons';

export interface DailyScheduleSlot {
  time: string; // e.g. "08:00 AM"
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  medicine: string;
  strength?: string;
  mealRelation: string; // e.g. "Empty stomach (30 mins before food)"
  instructions?: string;
}

interface DailyScheduleClockWidgetProps {
  slots: DailyScheduleSlot[];
}

export function DailyScheduleClockWidget({ slots }: DailyScheduleClockWidgetProps) {
  const [takenMap, setTakenMap] = useState<Record<number, boolean>>({});

  const toggleTaken = (idx: number) => {
    setTakenMap((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case 'morning':
        return <SunriseIcon size={14} className="text-amber-600" />;
      case 'afternoon':
        return <SunIcon size={14} className="text-amber-500" />;
      case 'evening':
        return <SunsetIcon size={14} className="text-orange-600" />;
      case 'night':
        return <MoonIcon size={14} className="text-indigo-600" />;
      default:
        return <ClockIcon size={14} className="text-teal-600" />;
    }
  };

  if (!slots || slots.length === 0) return null;

  return (
    <div className="my-3 p-4 bg-white border border-teal-200 rounded-2xl shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-800 font-bold text-xs flex items-center gap-1.5">
            <ClockIcon size={16} /> Daily Chronological Medication Clock
          </span>
          <Badge tone="ok" size="sm">{slots.length} Dose Steps</Badge>
        </div>
        <span className="text-[11px] text-ink-400">Chronological Routine</span>
      </div>

      {/* Visual Timeline Stepper */}
      <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-teal-100">
        {slots.map((slot, idx) => {
          const isTaken = Boolean(takenMap[idx]);

          return (
            <div key={idx} className="relative group">
              {/* Stepper Dot */}
              <div
                className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] transition-colors ${
                  isTaken
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'bg-white border-teal-400 text-teal-800'
                }`}
              >
                {isTaken ? <CheckIcon size={11} /> : idx + 1}
              </div>

              {/* Slot Box */}
              <div
                className={`p-3 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  isTaken
                    ? 'bg-teal-50/50 border-teal-200 opacity-75'
                    : 'bg-ink-50/40 border-ink-100 hover:border-teal-300 hover:bg-teal-50/30'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {getPeriodIcon(slot.period)}
                    <span className="font-mono font-bold text-teal-900 text-xs">{slot.time}</span>
                    <span className="font-bold text-ink-900">{slot.medicine}</span>
                    {slot.strength && <Badge tone="neutral" size="sm">{slot.strength}</Badge>}
                  </div>

                  <p className="text-[11px] text-ink-600 mt-1 flex items-center gap-1.5">
                    <span className="font-medium text-teal-800 flex items-center gap-1">
                      <MealIcon size={12} className="text-teal-700" /> {slot.mealRelation}
                    </span>
                    {slot.instructions && <span className="text-ink-400">• {slot.instructions}</span>}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleTaken(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                    isTaken
                      ? 'bg-teal-100 text-teal-900 border border-teal-300'
                      : 'bg-white text-ink-700 border border-ink-200 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 shadow-2xs'
                  }`}
                >
                  {isTaken ? (
                    <>
                      <CheckIcon size={12} className="text-emerald-600" /> Taken
                    </>
                  ) : (
                    'Mark Taken'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
