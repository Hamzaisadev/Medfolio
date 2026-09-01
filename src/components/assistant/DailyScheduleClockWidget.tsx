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
    <div className="my-3 p-3.5 sm:p-4 bg-surface-raised border border-line-strong rounded-2xl shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-content font-bold text-xs flex items-center gap-1.5">
            <ClockIcon size={16} className="text-accent shrink-0" /> Daily Chronological Medication Clock
          </span>
          <Badge tone="ok" size="sm">{slots.length} Dose Steps</Badge>
        </div>
        <span className="text-[11px] text-content-muted">Chronological Routine</span>
      </div>

      {/* Visual Timeline Stepper */}
      <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-accent/20">
        {slots.map((slot, idx) => {
          const isTaken = Boolean(takenMap[idx]);

          return (
            <div key={idx} className="relative group">
              {/* Stepper Dot */}
              <div
                className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${
                  isTaken
                    ? 'bg-ok-fill border-ok-border text-content-onaccent'
                    : 'bg-surface-raised border-accent text-accent'
                }`}
              >
                {isTaken ? <CheckIcon size={11} /> : idx + 1}
              </div>

              {/* Slot Box */}
              <div
                className={`p-3 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                  isTaken
                    ? 'bg-ok-bg/40 border-ok-border/40 opacity-80'
                    : 'bg-surface-sunken border-line hover:border-accent/40 hover:bg-surface-hover/50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {getPeriodIcon(slot.period)}
                    <span className="font-mono font-bold text-accent text-xs">{slot.time}</span>
                    <span className="font-bold text-content">{slot.medicine}</span>
                    {slot.strength && <Badge tone="neutral" size="sm">{slot.strength}</Badge>}
                  </div>

                  <p className="text-[11px] text-content-muted mt-1 flex items-center gap-1.5">
                    <span className="font-medium text-content flex items-center gap-1">
                      <MealIcon size={12} className="text-accent shrink-0" /> {slot.mealRelation}
                    </span>
                    {slot.instructions && <span className="text-content-subtle">• {slot.instructions}</span>}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleTaken(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                    isTaken
                      ? 'bg-ok-bg text-ok-text border border-ok-border'
                      : 'bg-surface-raised text-content border border-line hover:border-accent hover:text-accent shadow-2xs'
                  }`}
                >
                  {isTaken ? (
                    <>
                      <CheckIcon size={12} className="text-ok-text" /> Taken
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
