import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime } from '../../lib/time';
import { BUCKET_ORDER } from '../../domain/timeBuckets';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  Check,
  Grid3X3,
  Package,
} from 'lucide-react';

export function ScheduleTest8Page() {
  const {
    doses,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  // Extract unique medicines
  const uniqueMeds = Array.from(
    new Set(doses.map((d) => d.medicineName))
  ).map((name) => {
    const medDoses = doses.filter((d) => d.medicineName === name);
    const first = medDoses[0];
    return {
      name,
      strength: first?.strength || '',
      form: first?.form || 'tablet',
      remaining: first?.remaining ?? 0,
      instructions: first?.instructions || '',
      doses: medDoses,
    };
  });

  return (
    <AppShell>
      <TestDesignNavbar currentId={8} />

      <div className="max-w-6xl mx-auto space-y-5">
        {/* Matrix Header */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-line shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-surface-sunken border border-line flex items-center justify-center text-accent">
              <Grid3X3 size={16} />
            </span>
            <div>
              <h2 className="text-base font-bold text-content leading-tight">
                Daily Regimen Matrix (Medicine × Daypart)
              </h2>
              <p className="text-xs text-content-muted">
                Complete multi-dose polypharmacy overview across all 4 daily routines
              </p>
            </div>
          </div>

          <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            {takenCount}/{totalCount} Completed ({adherencePercent}%)
          </span>
        </div>

        {/* 2D Grid Table */}
        <div className="overflow-hidden rounded-3xl border border-line bg-surface-raised shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-sunken/80 border-b border-line text-content-subtle font-black uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4 w-60">Medicine & Strength</th>
                  {BUCKET_ORDER.map((bucket) => {
                    const slot = SLOT_META[bucket];
                    return (
                      <th key={bucket} className="py-3.5 px-4 text-center min-w-[130px]">
                        <div className="flex flex-col items-center">
                          <span>{slot.label}</span>
                          <span className="text-[9px] font-normal text-content-subtle lowercase">
                            {slot.timeRange}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-3.5 px-4 text-right w-28">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {uniqueMeds.map((med) => (
                  <tr key={med.name} className="hover:bg-surface-sunken/40 transition-colors">
                    {/* Medicine Name Column */}
                    <td className="py-4 px-4 font-bold text-content">
                      <div className="font-black text-sm">{med.name}</div>
                      <div className="text-[11px] text-content-muted font-semibold mt-0.5">
                        {med.strength} ({med.form})
                      </div>
                    </td>

                    {/* 4 Daypart Bucket Cells */}
                    {BUCKET_ORDER.map((bucket) => {
                      const dose = med.doses.find((d) => d.bucket === bucket);

                      if (!dose) {
                        return (
                          <td key={bucket} className="py-4 px-4 text-center">
                            <span className="text-content-subtle text-[11px] opacity-40">—</span>
                          </td>
                        );
                      }

                      const isTaken = dose.status === 'taken';
                      const isMissed = dose.status === 'missed';

                      return (
                        <td key={bucket} className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (isTaken) handleUndo(dose.id);
                              else handleTake(dose.id);
                            }}
                            className={clsx(
                              'p-2 rounded-2xl border transition-all inline-flex flex-col items-center gap-1 min-w-[100px] tap-spring cursor-pointer shadow-2xs',
                              isTaken
                                ? 'bg-teal-500/15 border-teal-500/40 text-teal-800 dark:text-teal-200'
                                : isMissed
                                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200 animate-pulse'
                                  : 'bg-surface-sunken hover:bg-surface-hover border-line text-content'
                            )}
                            title={isTaken ? 'Click to undo' : 'Click to mark taken'}
                          >
                            <span className="text-[10px] font-black">
                              {formatDoseTime(dose.scheduledMinutes)}
                            </span>
                            <div
                              className={clsx(
                                'w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shadow-xs',
                                isTaken
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-surface border border-line text-content-subtle'
                              )}
                            >
                              {isTaken ? <Check size={11} className="stroke-[3]" /> : '+'}
                            </div>
                            <span className="text-[9px] font-bold">
                              {isTaken ? 'Taken ✓' : 'Tap to log'}
                            </span>
                          </button>
                        </td>
                      );
                    })}

                    {/* Remaining Pills Column */}
                    <td className="py-4 px-4 text-right whitespace-nowrap font-bold">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1 text-[11px]',
                          med.remaining === 0
                            ? 'text-rose-600'
                            : med.remaining <= 5
                              ? 'text-amber-600'
                              : 'text-content-subtle'
                        )}
                      >
                        <Package size={11} /> {med.remaining} left
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
