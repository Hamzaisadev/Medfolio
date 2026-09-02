import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime } from '../../lib/time';
import { BUCKET_ORDER } from '../../domain/timeBuckets';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  Check,
  RotateCcw,
  Clock,
  Columns,
  Utensils,
  Droplets,
  AlertCircle,
} from 'lucide-react';

export function ScheduleTest3Page() {
  const {
    groupedBuckets,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
    handleBatchTake,
  } = useTestScheduleData();

  return (
    <AppShell>
      <TestDesignNavbar currentId={3} />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 p-4.5 rounded-2xl bg-surface-raised border border-line shadow-2xs flex-wrap">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-content flex items-center gap-2">
              <Columns size={18} className="text-accent" /> Routine Kanban Boards
            </h2>
            <p className="text-xs text-content-muted">
              Organized by daypart routine columns with instant progress tracking
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-bold text-content">{takenCount}/{totalCount} Taken</span>
              <div className="w-28 h-2 rounded-full bg-surface-sunken overflow-hidden border border-line mt-1">
                <div
                  style={{ width: `${adherencePercent}%` }}
                  className="h-full bg-teal-600 transition-all duration-500"
                />
              </div>
            </div>
            <span className="text-xs font-black text-teal-700 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 rounded-xl">
              {adherencePercent}%
            </span>
          </div>
        </div>

        {/* 4-Column Kanban Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {BUCKET_ORDER.map((key) => {
            const slot = SLOT_META[key];
            const doses = groupedBuckets[key];
            const completed = doses.filter((d) => d.status === 'taken').length;
            const pending = doses.filter((d) => d.status === 'pending' || d.status === 'missed').length;
            const allDone = doses.length > 0 && completed === doses.length;

            return (
              <div
                key={key}
                className={clsx(
                  'rounded-3xl border bg-surface-raised/70 backdrop-blur-xs p-3.5 space-y-3 flex flex-col min-h-[420px] transition-all',
                  allDone
                    ? 'border-teal-500/30 bg-teal-500/5'
                    : pending > 0
                      ? 'border-line shadow-2xs'
                      : 'border-line/60'
                )}
              >
                {/* Column Header */}
                <div className="p-2.5 rounded-2xl bg-surface-sunken/80 border border-line flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs',
                        slot.surface,
                        slot.text
                      )}
                    >
                      {slot.icon(14)}
                    </span>
                    <div>
                      <h3 className="text-xs font-black text-content uppercase tracking-tight">
                        {slot.label}
                      </h3>
                      <span className="text-[10px] text-content-subtle font-medium">
                        {slot.timeRange}
                      </span>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-lg text-[10px] font-black',
                      allDone
                        ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                        : 'bg-surface-sunken text-content-subtle border border-line'
                    )}
                  >
                    {completed}/{doses.length}
                  </span>
                </div>

                {/* Batch Button if pending */}
                {pending > 1 && (
                  <button
                    type="button"
                    onClick={() => handleBatchTake(key)}
                    className="w-full py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-500/20 transition-all cursor-pointer tap-spring"
                  >
                    Take all {pending} due ✓
                  </button>
                )}

                {/* Doses in this column */}
                <div className="space-y-2.5 flex-1">
                  {doses.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-content-subtle italic">
                      No medications scheduled
                    </div>
                  ) : (
                    doses.map((dose) => {
                      const isTaken = dose.status === 'taken';
                      const isMissed = dose.status === 'missed';

                      return (
                        <div
                          key={dose.id}
                          className={clsx(
                            'p-3.5 rounded-2xl border bg-surface-raised transition-all duration-200 shadow-2xs hover:shadow-card-hover space-y-2.5',
                            isTaken
                              ? 'border-line/60 opacity-80'
                              : isMissed
                                ? 'border-amber-400 bg-amber-500/5'
                                : 'border-line'
                          )}
                        >
                          {/* Card Top */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-content bg-surface-sunken px-2 py-0.5 rounded-lg border border-line">
                              <Clock size={10} /> {formatDoseTime(dose.scheduledMinutes)}
                            </span>

                            {dose.remaining <= 5 && (
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                                <AlertCircle size={10} /> {dose.remaining} left
                              </span>
                            )}
                          </div>

                          {/* Medicine Info */}
                          <div>
                            <h4
                              className={clsx(
                                'text-sm font-bold text-content tracking-tight',
                                isTaken && 'line-through text-content-muted'
                              )}
                            >
                              {dose.medicineName}
                            </h4>
                            <p className="text-[11px] text-content-muted font-medium">
                              {dose.strength} · {dose.doseAmount}
                            </p>
                          </div>

                          {/* Instructions tag */}
                          {dose.instructions && (
                            <p className="text-[10px] text-content-subtle bg-surface-sunken p-1.5 rounded-lg line-clamp-2">
                              {dose.instructions}
                            </p>
                          )}

                          {/* Card Bottom CTA */}
                          <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-content-subtle">
                              {dose.withFood === true ? (
                                <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                  <Utensils size={10} /> With food
                                </span>
                              ) : dose.withFood === false ? (
                                <span className="text-blue-800 dark:text-blue-300 flex items-center gap-1">
                                  <Droplets size={10} /> Empty stomach
                                </span>
                              ) : (
                                'As directed'
                              )}
                            </span>

                            {!isTaken ? (
                              <button
                                type="button"
                                onClick={() => handleTake(dose.id)}
                                className={clsx(
                                  'px-3 py-1 rounded-xl text-xs font-bold text-white shadow-2xs tap-spring cursor-pointer flex items-center gap-1',
                                  isMissed
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-teal-600 hover:bg-teal-700'
                                )}
                              >
                                <Check size={11} className="stroke-[3]" />
                                {isMissed ? 'Overdue' : 'Take'}
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                                  ✓ Logged
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUndo(dose.id)}
                                  className="text-[10px] text-content-subtle hover:text-content"
                                  title="Undo"
                                >
                                  <RotateCcw size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
