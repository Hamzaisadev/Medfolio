import { motion } from 'motion/react';
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
  Pill,
} from 'lucide-react';

export function ScheduleTest10Page() {
  const {
    doses,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  return (
    <AppShell>
      <TestDesignNavbar currentId={10} />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Floating Glass Header */}
        <div className="p-6 rounded-3xl bg-linear-to-r from-teal-900/10 via-accent/5 to-indigo-900/10 border border-line backdrop-blur-md shadow-sm flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent text-white flex items-center justify-center shadow-md">
              <Pill size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-content tracking-tight">
                Floating Capsule Stream
              </h2>
              <p className="text-xs text-content-muted">
                3D dual-tone capsule pills with tactile fluid confirmation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black px-3.5 py-1.5 rounded-2xl bg-teal-500/15 text-teal-800 dark:text-teal-200 border border-teal-500/30 shadow-2xs">
              {takenCount}/{totalCount} Completed ({adherencePercent}%)
            </span>
          </div>
        </div>

        {/* Floating Capsule Stream */}
        <div className="space-y-4">
          {doses.map((dose, idx) => {
            const isTaken = dose.status === 'taken';
            const isMissed = dose.status === 'missed';
            const slot = SLOT_META[dose.bucket];

            return (
              <motion.div
                key={dose.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={clsx(
                  'p-5 sm:p-6 rounded-3xl border-2 transition-all duration-200 shadow-sm relative overflow-hidden bg-surface-raised',
                  isTaken
                    ? 'border-line/60 bg-surface-raised opacity-80'
                    : isMissed
                      ? 'border-amber-400 bg-amber-500/5 shadow-amber-500/5'
                      : 'border-line hover:border-accent/60 hover:shadow-md'
                )}
              >
                {/* Capsule Left Color Accent Band */}
                <div
                  className={clsx(
                    'absolute top-0 bottom-0 left-0 w-2.5',
                    isTaken ? 'bg-teal-600' : isMissed ? 'bg-amber-500' : slot.surface
                  )}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-2">
                  {/* Left Pill Info & Timing */}
                  <div className="flex items-start sm:items-center gap-4">
                    {/* Visual 3D Capsule Icon */}
                    <div
                      className={clsx(
                        'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs transition-all',
                        isTaken
                          ? 'bg-teal-600 border-teal-700 text-white'
                          : 'bg-surface-sunken text-accent border-line'
                      )}
                    >
                      {isTaken ? (
                        <Check size={22} className="stroke-[3]" />
                      ) : (
                        <div className="w-6 h-8 rounded-full border-2 border-accent bg-linear-to-b from-accent to-white shadow-2xs" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl bg-surface-sunken border border-line text-xs font-black text-content">
                          <Clock size={11} /> {formatDoseTime(dose.scheduledMinutes)}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-content-subtle">
                          {slot.label}
                        </span>
                        {dose.remaining <= 5 && (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md">
                            {dose.remaining === 0 ? 'Out of stock' : `Low: ${dose.remaining} left`}
                          </span>
                        )}
                      </div>

                      <h3
                        className={clsx(
                          'text-lg font-black text-content tracking-tight mt-1',
                          isTaken && 'line-through text-content-muted'
                        )}
                      >
                        {dose.medicineName}
                      </h3>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-content-muted font-semibold">
                        <span>{dose.strength}</span>
                        <span>·</span>
                        <span>{dose.doseAmount}</span>
                        <span>·</span>
                        {dose.withFood === true ? (
                          <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-0.5">
                            <Utensils size={11} /> With food
                          </span>
                        ) : dose.withFood === false ? (
                          <span className="text-blue-800 dark:text-blue-300 font-bold flex items-center gap-0.5">
                            <Droplets size={11} /> Empty stomach
                          </span>
                        ) : (
                          <span>As directed</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Button */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!isTaken ? (
                      <button
                        type="button"
                        onClick={() => handleTake(dose.id)}
                        className={clsx(
                          'px-5 py-2.5 rounded-2xl text-xs font-black text-white shadow-md tap-spring flex items-center gap-2 cursor-pointer',
                          isMissed
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-teal-600 hover:bg-teal-700'
                        )}
                      >
                        <Check size={14} className="stroke-[3]" />
                        {isMissed ? 'Take Overdue' : 'Log Taken'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-teal-700 dark:text-teal-400">
                          ✓ Logged
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndo(dose.id)}
                          className="p-2 rounded-xl text-xs font-bold text-content-subtle hover:text-content bg-surface-sunken border border-line"
                          title="Undo"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    )}
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
