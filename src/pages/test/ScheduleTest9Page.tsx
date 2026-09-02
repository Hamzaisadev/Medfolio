import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime } from '../../lib/time';
import { BUCKET_ORDER } from '../../domain/timeBuckets';
import { SLOT_META } from '../../components/ui/slotMeta';
import { RotateCcw } from 'lucide-react';

export function ScheduleTest9Page() {
  const {
    groupedBuckets,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  return (
    <AppShell>
      <TestDesignNavbar currentId={9} />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Concentric Daypart Ring Card */}
        <div className="p-6 rounded-3xl bg-surface-raised border border-line shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Ring Graphics Simulator */}
          <div className="flex items-center gap-6">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Concentric Circle Rings (SVG) */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                {/* Ring 1: Morning (Outer) */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  className="stroke-amber-200/40 dark:stroke-amber-950 fill-none stroke-[7]"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  strokeDasharray="314"
                  strokeDashoffset={
                    314 -
                    314 *
                      (groupedBuckets.morning.filter((d) => d.status === 'taken').length /
                        (groupedBuckets.morning.length || 1))
                  }
                  className="stroke-amber-500 fill-none stroke-[7] stroke-linecap-round transition-all duration-700"
                />

                {/* Ring 2: Afternoon */}
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  className="stroke-sky-200/40 dark:stroke-sky-950 fill-none stroke-[7]"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="40"
                  strokeDasharray="251"
                  strokeDashoffset={
                    251 -
                    251 *
                      (groupedBuckets.afternoon.filter((d) => d.status === 'taken').length /
                        (groupedBuckets.afternoon.length || 1))
                  }
                  className="stroke-sky-500 fill-none stroke-[7] stroke-linecap-round transition-all duration-700"
                />

                {/* Ring 3: Evening */}
                <circle
                  cx="60"
                  cy="60"
                  r="30"
                  className="stroke-violet-200/40 dark:stroke-violet-950 fill-none stroke-[7]"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="30"
                  strokeDasharray="188"
                  strokeDashoffset={
                    188 -
                    188 *
                      (groupedBuckets.evening.filter((d) => d.status === 'taken').length /
                        (groupedBuckets.evening.length || 1))
                  }
                  className="stroke-violet-500 fill-none stroke-[7] stroke-linecap-round transition-all duration-700"
                />

                {/* Ring 4: Night (Inner) */}
                <circle
                  cx="60"
                  cy="60"
                  r="20"
                  className="stroke-indigo-200/40 dark:stroke-indigo-950 fill-none stroke-[7]"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="20"
                  strokeDasharray="125"
                  strokeDashoffset={
                    125 -
                    125 *
                      (groupedBuckets.night.filter((d) => d.status === 'taken').length /
                        (groupedBuckets.night.length || 1))
                  }
                  className="stroke-indigo-500 fill-none stroke-[7] stroke-linecap-round transition-all duration-700"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-base font-black text-content">{adherencePercent}%</span>
              </div>
            </div>

            {/* Ring Legend */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-bold text-content">Morning Routine</span>
                <span className="text-content-subtle font-semibold">
                  (
                  {groupedBuckets.morning.filter((d) => d.status === 'taken').length}/
                  {groupedBuckets.morning.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-500" />
                <span className="font-bold text-content">Afternoon Routine</span>
                <span className="text-content-subtle font-semibold">
                  (
                  {groupedBuckets.afternoon.filter((d) => d.status === 'taken').length}/
                  {groupedBuckets.afternoon.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-500" />
                <span className="font-bold text-content">Evening Routine</span>
                <span className="text-content-subtle font-semibold">
                  (
                  {groupedBuckets.evening.filter((d) => d.status === 'taken').length}/
                  {groupedBuckets.evening.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500" />
                <span className="font-bold text-content">Night Routine</span>
                <span className="text-content-subtle font-semibold">
                  (
                  {groupedBuckets.night.filter((d) => d.status === 'taken').length}/
                  {groupedBuckets.night.length})
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-content-subtle uppercase">Daily Score</span>
            <div className="text-2xl sm:text-3xl font-black text-teal-700 dark:text-teal-400">
              {takenCount} of {totalCount} Doses
            </div>
            <p className="text-xs text-content-muted mt-1">Close all 4 routine rings today</p>
          </div>
        </div>

        {/* Routine Daypart Micro-Pods */}
        <div className="space-y-4">
          {BUCKET_ORDER.map((key) => {
            const slot = SLOT_META[key];
            const doses = groupedBuckets[key];

            return (
              <div
                key={key}
                className="p-5 rounded-3xl bg-surface-raised border border-line shadow-2xs space-y-3"
              >
                {/* Pod Header */}
                <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs',
                        slot.surface,
                        slot.text
                      )}
                    >
                      {slot.icon(14)}
                    </span>
                    <h3 className="text-sm font-bold text-content uppercase tracking-tight">
                      {slot.label} Routine Pod
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-content-subtle">
                    {slot.timeRange}
                  </span>
                </div>

                {/* Dose Cards inside pod */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {doses.map((dose) => {
                    const isTaken = dose.status === 'taken';

                    return (
                      <div
                        key={dose.id}
                        className={clsx(
                          'p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all',
                          isTaken
                            ? 'bg-surface-sunken/40 border-line/40 opacity-75'
                            : 'bg-surface-raised border-line hover:border-line-strong'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-content-subtle bg-surface-sunken px-1.5 py-0.5 rounded-md border border-line">
                              {formatDoseTime(dose.scheduledMinutes)}
                            </span>
                            <span className="text-[10px] font-bold text-content-subtle">
                              {dose.remaining} in stock
                            </span>
                          </div>
                          <h4
                            className={clsx(
                              'text-sm font-bold text-content mt-1 truncate',
                              isTaken && 'line-through text-content-muted'
                            )}
                          >
                            {dose.medicineName}
                          </h4>
                          <span className="text-[11px] text-content-muted font-medium">
                            {dose.strength} · {dose.doseAmount}
                          </span>
                        </div>

                        {!isTaken ? (
                          <button
                            type="button"
                            onClick={() => handleTake(dose.id)}
                            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs tap-spring shrink-0 cursor-pointer"
                          >
                            Log ✓
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUndo(dose.id)}
                            className="p-1.5 rounded-lg text-content-subtle hover:text-content shrink-0"
                            title="Undo"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
