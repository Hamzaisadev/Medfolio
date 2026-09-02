import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime } from '../../lib/time';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  Check,
  RotateCcw,
  Clock,
  Utensils,
  Droplets,
  Package,
} from 'lucide-react';

export function ScheduleTest1Page() {
  const {
    doses,
    takenCount,
    totalCount,
    adherencePercent,
    toastMessage,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  return (
    <AppShell>
      <TestDesignNavbar currentId={1} />

      {/* Toast message if any */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-between"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Adherence Bar */}
        <div className="p-4 sm:p-5 rounded-2xl bg-surface-raised border border-line shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-content">
                Today's Chronological Feed
              </h2>
            </div>
            <p className="text-xs text-content-muted mt-0.5">
              Continuous 24-hour timeline ordered by exact administration timestamp
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-black text-content">{adherencePercent}% Adherence</div>
              <div className="text-[11px] text-content-subtle font-medium">
                {takenCount} of {totalCount} completed
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center font-black text-teal-700 dark:text-teal-400 text-sm">
              {takenCount}/{totalCount}
            </div>
          </div>
        </div>

        {/* Continuous Vertical Timeline Track */}
        <div className="relative pl-6 sm:pl-10 space-y-6 before:absolute before:left-3 sm:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-linear-to-b before:from-amber-400 before:via-teal-500 before:to-indigo-600">
          {doses.map((dose, index) => {
            const slot = SLOT_META[dose.bucket];
            const isTaken = dose.status === 'taken';
            const isMissed = dose.status === 'missed';
            const isNext =
              !isTaken &&
              !isMissed &&
              doses.findIndex((d) => d.status === 'pending') === index;

            return (
              <motion.div
                key={dose.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group"
              >
                {/* Timeline Dot Node on the rail */}
                <span
                  className={clsx(
                    'absolute -left-6 sm:-left-10 top-5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center -translate-x-1/2 border-2 transition-all shadow-xs z-10',
                    isTaken
                      ? 'bg-teal-600 border-white text-white'
                      : isMissed
                        ? 'bg-amber-500 border-white text-white animate-pulse'
                        : isNext
                          ? 'bg-accent border-white text-white ring-4 ring-accent/20'
                          : 'bg-surface-raised border-line-strong text-content-subtle'
                  )}
                >
                  {isTaken ? (
                    <Check size={13} className="stroke-[3]" />
                  ) : (
                    <span className="text-[10px] font-black">{index + 1}</span>
                  )}
                </span>

                {/* Main Medication Event Tile */}
                <div
                  className={clsx(
                    'p-4 sm:p-5 rounded-2xl border transition-all duration-200 shadow-2xs hover:shadow-card-hover relative overflow-hidden bg-surface-raised',
                    isNext && 'ring-2 ring-accent/40 border-accent/40 shadow-sm',
                    isTaken
                      ? 'border-line/60 opacity-85'
                      : isMissed
                        ? 'border-amber-400/80 bg-amber-500/5'
                        : 'border-line hover:border-line-strong'
                  )}
                >
                  {/* Top Circadian Header */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs',
                          isTaken
                            ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-200 border-emerald-300'
                            : isMissed
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-200 border-amber-300'
                              : 'bg-surface-sunken text-content border-line-strong/60'
                        )}
                      >
                        <Clock size={12} />
                        {formatDoseTime(dose.scheduledMinutes)}
                      </span>

                      <span className="text-xs font-bold uppercase tracking-wider text-content-subtle">
                        {slot.label} Routine
                      </span>

                      {isNext && (
                        <span className="px-2 py-0.5 rounded-md bg-accent text-white font-black text-[10px] uppercase tracking-wider shadow-2xs">
                          Up Next
                        </span>
                      )}
                    </div>

                    {/* Stock Status Badge */}
                    <span
                      className={clsx(
                        'text-xs font-bold flex items-center gap-1',
                        dose.remaining === 0
                          ? 'text-rose-600'
                          : dose.remaining <= 5
                            ? 'text-amber-600'
                            : 'text-content-subtle'
                      )}
                    >
                      <Package size={12} />
                      {dose.remaining === 0
                        ? 'Out of Stock'
                        : `${dose.remaining} left`}
                    </span>
                  </div>

                  {/* Medicine Body */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3
                        className={clsx(
                          'text-base sm:text-lg font-bold text-content tracking-tight',
                          isTaken && 'line-through text-content-muted'
                        )}
                      >
                        {dose.medicineName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-surface-sunken border border-line text-content font-bold text-xs">
                          {dose.strength}
                        </span>
                        <span className="text-xs text-content-muted font-medium">
                          {dose.doseAmount} ({dose.form})
                        </span>
                        {dose.withFood === true && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                            <Utensils size={11} /> With food
                          </span>
                        )}
                        {dose.withFood === false && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                            <Droplets size={11} /> Empty stomach
                          </span>
                        )}
                      </div>
                      {dose.instructions && (
                        <p className="text-xs text-content-muted mt-2 italic bg-surface-sunken/60 p-2 rounded-xl border border-line/40">
                          {dose.instructions}
                        </p>
                      )}
                    </div>

                    {/* Right Side Action Button */}
                    <div className="shrink-0 flex items-center gap-2 pt-1">
                      {!isTaken ? (
                        <button
                          type="button"
                          onClick={() => handleTake(dose.id)}
                          className={clsx(
                            'px-4 py-2 rounded-xl text-xs font-bold text-white shadow-2xs tap-spring flex items-center gap-1.5 cursor-pointer',
                            isMissed
                              ? 'bg-amber-600 hover:bg-amber-700'
                              : 'bg-teal-600 hover:bg-teal-700'
                          )}
                        >
                          <Check size={14} className="stroke-[3]" />
                          {isMissed ? 'Log Overdue' : 'Log Taken'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                            <Check size={14} className="stroke-[3]" /> Taken
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUndo(dose.id)}
                            className="p-1.5 rounded-lg text-content-subtle hover:text-content hover:bg-surface-sunken"
                            title="Undo dose"
                          >
                            <RotateCcw size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
