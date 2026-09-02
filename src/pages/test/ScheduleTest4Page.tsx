import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime, minutesInAppTz } from '../../lib/time';
import { BUCKET_ORDER } from '../../domain/timeBuckets';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  Check,
  RotateCcw,
  Clock,
  Flame,
  Package,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export function ScheduleTest4Page() {
  const {
    doses,
    groupedBuckets,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  const nowMinutes = minutesInAppTz();
  const outstanding = doses.filter(
    (d) => d.status === 'pending' || d.status === 'missed'
  );
  const nextDose =
    outstanding.find((d) => d.scheduledMinutes >= nowMinutes) || outstanding[0];

  return (
    <AppShell>
      <TestDesignNavbar currentId={4} />

      <div className="max-w-6xl mx-auto space-y-5">
        {/* Bento Grid Top Tier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Bento 1: Hero Next Due Medication (7 Cols) */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-linear-to-br from-teal-900 to-emerald-950 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider text-emerald-200 border border-white/10">
                  <ShieldCheck size={12} className="text-amber-300" />
                  {nextDose ? 'Next Due Administration' : 'All Doses Completed'}
                </span>

                {nextDose && (
                  <span className="text-xs font-bold text-emerald-200 flex items-center gap-1">
                    <Clock size={12} /> {formatDoseTime(nextDose.scheduledMinutes)}
                  </span>
                )}
              </div>

              {nextDose ? (
                <div className="mt-5 space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {nextDose.medicineName}
                  </h2>
                  <p className="text-sm font-semibold text-emerald-100 flex items-center gap-2">
                    <span>{nextDose.strength}</span>
                    <span>·</span>
                    <span>{nextDose.doseAmount}</span>
                    <span>·</span>
                    <span>{nextDose.withFood ? 'With food' : 'Empty stomach'}</span>
                  </p>
                  {nextDose.instructions && (
                    <p className="text-xs text-emerald-200/80 bg-white/10 p-2.5 rounded-xl backdrop-blur-xs max-w-lg mt-3">
                      {nextDose.instructions}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-6 py-4">
                  <h3 className="text-xl font-bold text-emerald-200">
                    You are completely caught up for today!
                  </h3>
                  <p className="text-xs text-emerald-300/80 mt-1">
                    All scheduled doses have been safely recorded.
                  </p>
                </div>
              )}
            </div>

            {nextDose && (
              <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between gap-4 relative z-10">
                <span className="text-xs text-emerald-200 font-semibold flex items-center gap-1.5">
                  <Package size={13} /> {nextDose.remaining} in cabinet
                </span>
                <button
                  type="button"
                  onClick={() => handleTake(nextDose.id)}
                  className="px-6 py-2.5 rounded-2xl bg-white text-teal-950 font-black text-xs hover:bg-emerald-50 shadow-lg tap-spring cursor-pointer flex items-center gap-2"
                >
                  <Check size={16} className="stroke-[3] text-teal-700" />
                  Log Taken Now
                </button>
              </div>
            )}
          </div>

          {/* Bento 2: Adherence & Streak OS Widget (5 Cols) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-4">
            {/* Adherence Score Box */}
            <div className="p-5 rounded-3xl bg-surface-raised border border-line shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-content-subtle uppercase">
                  Adherence
                </span>
                <div className="text-3xl font-black text-content mt-1">
                  {adherencePercent}%
                </div>
                <p className="text-xs text-teal-700 dark:text-teal-400 font-bold mt-0.5">
                  {takenCount} of {totalCount} logged
                </p>
              </div>
              <div className="w-full bg-surface-sunken h-2.5 rounded-full overflow-hidden border border-line mt-4">
                <div
                  style={{ width: `${adherencePercent}%` }}
                  className="h-full bg-teal-600 rounded-full transition-all duration-500"
                />
              </div>
            </div>

            {/* Streak Bento Box */}
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase flex items-center gap-1">
                  <Flame size={13} className="text-amber-600 fill-amber-600" />
                  Active Streak
                </span>
                <div className="text-3xl font-black text-amber-950 dark:text-amber-100 mt-1">
                  14 Days
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mt-0.5">
                  Top 5% consistency
                </p>
              </div>
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 bg-amber-500/20 px-2 py-1 rounded-lg self-start">
                Gold Tier ⭐
              </span>
            </div>

            {/* Stock Health Widget (Full Width below stats) */}
            <div className="col-span-2 p-4 rounded-2xl bg-surface-raised border border-line flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-accent" />
                <div>
                  <h4 className="font-bold text-content">Cabinet Inventory</h4>
                  <p className="text-[11px] text-content-subtle">
                    {doses.filter((d) => d.remaining <= 5).length} items need refill soon
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded-xl bg-surface-sunken border border-line hover:bg-surface-hover font-bold text-content text-xs flex items-center gap-1"
              >
                Refill Hub <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Bento Grid Bottom Tier: 4 Daypart Bento Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BUCKET_ORDER.map((key) => {
            const slot = SLOT_META[key];
            const bucketDoses = groupedBuckets[key];

            return (
              <div
                key={key}
                className="p-4 rounded-3xl bg-surface-raised border border-line shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-line/60">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
                          slot.surface,
                          slot.text
                        )}
                      >
                        {slot.icon(12)}
                      </span>
                      <h4 className="text-xs font-bold text-content uppercase tracking-tight">
                        {slot.label}
                      </h4>
                    </div>
                    <span className="text-[10px] text-content-subtle font-semibold">
                      {slot.timeRange}
                    </span>
                  </div>

                  <div className="space-y-2 mt-3">
                    {bucketDoses.map((dose) => {
                      const isTaken = dose.status === 'taken';
                      return (
                        <div
                          key={dose.id}
                          className={clsx(
                            'p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all',
                            isTaken
                              ? 'bg-surface-sunken/40 border-line/40 opacity-70'
                              : 'bg-surface-sunken/80 border-line'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <h5
                              className={clsx(
                                'text-xs font-bold text-content truncate',
                                isTaken && 'line-through text-content-muted'
                              )}
                            >
                              {dose.medicineName}
                            </h5>
                            <span className="text-[10px] text-content-subtle font-medium">
                              {dose.strength} · {formatDoseTime(dose.scheduledMinutes)}
                            </span>
                          </div>

                          {!isTaken ? (
                            <button
                              type="button"
                              onClick={() => handleTake(dose.id)}
                              className="w-7 h-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center tap-spring shadow-2xs shrink-0 cursor-pointer"
                              title="Take dose"
                            >
                              <Check size={13} className="stroke-[3]" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUndo(dose.id)}
                              className="w-6 h-6 rounded-lg text-content-subtle hover:text-content flex items-center justify-center shrink-0"
                              title="Undo"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
