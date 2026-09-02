import { motion } from 'motion/react';
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
  Layers,
  Utensils,
  Droplets,
} from 'lucide-react';

export function ScheduleTest5Page() {
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
      <TestDesignNavbar currentId={5} />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Pillbox Dispenser Header */}
        <div className="p-5 rounded-3xl bg-surface-raised border border-line shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-content flex items-center gap-2">
              <Layers size={18} className="text-accent" /> Digital Smart Pillbox Dispenser
            </h2>
            <p className="text-xs text-content-muted">
              Tap any blister bubble to pop and log your dose with realistic tactile feedback
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-content">
              {takenCount} of {totalCount} popped
            </span>
            <div className="px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 font-black text-xs">
              {adherencePercent}% Complete
            </div>
          </div>
        </div>

        {/* 4-Slot Physical Blister Pack Frame */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {BUCKET_ORDER.map((key) => {
            const slot = SLOT_META[key];
            const doses = groupedBuckets[key];

            return (
              <div
                key={key}
                className="rounded-3xl border-2 border-line-strong bg-linear-to-b from-surface-raised to-surface-sunken p-5 shadow-md relative overflow-hidden space-y-4"
              >
                {/* Blister Compartment Lid Header */}
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={clsx(
                        'w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shadow-inner',
                        slot.surface,
                        slot.text
                      )}
                    >
                      {slot.icon(16)}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-content uppercase tracking-tight">
                        {slot.label} Tray
                      </h3>
                      <span className="text-[11px] text-content-subtle font-semibold">
                        {slot.timeRange}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface border border-line text-content-subtle">
                    {doses.length} {doses.length === 1 ? 'pill' : 'pills'}
                  </span>
                </div>

                {/* Blister Cells / Pill Bubbles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {doses.map((dose) => {
                    const isTaken = dose.status === 'taken';

                    return (
                      <motion.div
                        key={dose.id}
                        whileTap={{ scale: 0.96 }}
                        className={clsx(
                          'p-4 rounded-2xl border-2 transition-all relative overflow-hidden flex flex-col justify-between min-h-[140px]',
                          isTaken
                            ? 'bg-surface-sunken/40 border-line/40 shadow-inner'
                            : 'bg-surface-raised border-teal-500/40 hover:border-teal-500 shadow-sm cursor-pointer hover:-translate-y-0.5'
                        )}
                        onClick={() => {
                          if (!isTaken) handleTake(dose.id);
                        }}
                      >
                        {/* Pill Bubble Top */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-content-subtle bg-surface-sunken px-2 py-0.5 rounded-md border border-line">
                            {formatDoseTime(dose.scheduledMinutes)}
                          </span>

                          {/* 3D Visual Pill Graphic */}
                          <div
                            className={clsx(
                              'w-6 h-6 rounded-full border shadow-2xs flex items-center justify-center transition-all',
                              isTaken
                                ? 'bg-teal-600 border-teal-700 text-white'
                                : 'bg-linear-to-br from-teal-400 to-emerald-500 border-teal-500 shadow-sm'
                            )}
                          >
                            {isTaken ? (
                              <Check size={12} className="stroke-[3]" />
                            ) : (
                              <div className="w-2.5 h-1 bg-white/70 rounded-full" />
                            )}
                          </div>
                        </div>

                        {/* Medicine Metadata */}
                        <div className="my-2">
                          <h4
                            className={clsx(
                              'text-sm font-bold text-content leading-tight',
                              isTaken && 'line-through text-content-muted'
                            )}
                          >
                            {dose.medicineName}
                          </h4>
                          <p className="text-[11px] text-content-muted font-medium mt-0.5">
                            {dose.strength} · {dose.form}
                          </p>
                        </div>

                        {/* Blister Cell Footer Action */}
                        <div className="pt-2 border-t border-line/50 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-content-subtle">
                            {dose.withFood === true ? (
                              <span className="text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                                <Utensils size={9} /> Food
                              </span>
                            ) : dose.withFood === false ? (
                              <span className="text-blue-800 dark:text-blue-300 flex items-center gap-0.5">
                                <Droplets size={9} /> Empty
                              </span>
                            ) : (
                              'Anytime'
                            )}
                          </span>

                          {!isTaken ? (
                            <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                              Tap to Pop
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUndo(dose.id);
                              }}
                              className="text-[10px] text-content-subtle hover:text-content flex items-center gap-0.5"
                            >
                              <RotateCcw size={10} /> Undo
                            </button>
                          )}
                        </div>
                      </motion.div>
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
