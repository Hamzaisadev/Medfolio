import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime } from '../../lib/time';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Droplets,
  Package,
  Target,
} from 'lucide-react';

export function ScheduleTest7Page() {
  const {
    doses,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
  } = useTestScheduleData();

  const [activeIndex, setActiveIndex] = useState(0);
  const activeDose = doses[activeIndex] || doses[0];
  const isTaken = activeDose?.status === 'taken';
  const isMissed = activeDose?.status === 'missed';
  const slot = activeDose ? SLOT_META[activeDose.bucket] : SLOT_META.morning;

  const nextIndex = () => setActiveIndex((prev) => (prev + 1) % doses.length);
  const prevIndex = () =>
    setActiveIndex((prev) => (prev - 1 + doses.length) % doses.length);

  return (
    <AppShell>
      <TestDesignNavbar currentId={7} />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent/10 text-accent">
              <Target size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-content">Focus Mode Deck</h2>
              <p className="text-xs text-content-muted">
                Step-by-step single dose focus with instant one-tap completion
              </p>
            </div>
          </div>

          <span className="text-xs font-black text-teal-700 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 rounded-xl">
            {takenCount} of {totalCount} Done ({adherencePercent}%)
          </span>
        </div>

        {/* Big Spotlight Focus Card */}
        {activeDose && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeDose.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className={clsx(
                'p-6 sm:p-8 rounded-3xl border-2 bg-surface-raised shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[380px]',
                isTaken
                  ? 'border-teal-500/40 bg-teal-500/5'
                  : isMissed
                    ? 'border-amber-400 bg-amber-500/5'
                    : 'border-line-strong'
              )}
            >
              {/* Card Top Pill */}
              <div className="flex items-center justify-between">
                <span
                  className={clsx(
                    'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black border shadow-2xs',
                    isTaken
                      ? 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/30'
                      : 'bg-surface-sunken text-content border-line-strong'
                  )}
                >
                  <Clock size={13} />
                  {formatDoseTime(activeDose.scheduledMinutes)} ({slot.label})
                </span>

                <span className="text-xs font-bold text-content-subtle flex items-center gap-1">
                  <Package size={13} /> {activeDose.remaining} tablets left
                </span>
              </div>

              {/* Medicine Large Title & Info */}
              <div className="my-6 space-y-2.5">
                <h3
                  className={clsx(
                    'text-2xl sm:text-4xl font-black text-content tracking-tight',
                    isTaken && 'line-through text-content-muted'
                  )}
                >
                  {activeDose.medicineName}
                </h3>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-3 py-1 rounded-xl bg-surface-sunken border border-line text-content font-black text-sm">
                    {activeDose.strength}
                  </span>
                  <span className="text-sm text-content-muted font-bold">
                    {activeDose.doseAmount} ({activeDose.form})
                  </span>
                  {activeDose.withFood === true && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                      <Utensils size={12} /> Take with food
                    </span>
                  )}
                  {activeDose.withFood === false && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 dark:text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                      <Droplets size={12} /> Take on empty stomach
                    </span>
                  )}
                </div>

                {activeDose.instructions && (
                  <p className="text-xs text-content-muted bg-surface-sunken p-3 rounded-2xl border border-line/60 mt-3 leading-relaxed">
                    {activeDose.instructions}
                  </p>
                )}
              </div>

              {/* Giant Bottom Action CTA */}
              <div className="pt-4 border-t border-line/60 flex items-center justify-between gap-4">
                {!isTaken ? (
                  <button
                    type="button"
                    onClick={() => handleTake(activeDose.id)}
                    className="w-full py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-black text-sm shadow-md tap-spring flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={18} className="stroke-[3]" />
                    Mark this dose as taken
                  </button>
                ) : (
                  <div className="w-full flex items-center justify-between">
                    <span className="text-sm font-black text-teal-700 dark:text-teal-400 flex items-center gap-2">
                      <Check size={18} className="stroke-[3]" /> Successfully Logged
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUndo(activeDose.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-content-subtle hover:text-content bg-surface-sunken border border-line"
                    >
                      Undo
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Bottom Scrubber Deck Navigator */}
        <div className="p-3 rounded-2xl bg-surface-raised border border-line flex items-center justify-between gap-2 shadow-2xs">
          <button
            type="button"
            onClick={prevIndex}
            className="p-2 rounded-xl bg-surface-sunken border border-line text-content hover:bg-surface-hover tap-spring"
            title="Previous dose"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto px-2">
            {doses.map((dose, idx) => {
              const isSelected = activeIndex === idx;
              const isDone = dose.status === 'taken';

              return (
                <button
                  key={dose.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 tap-spring cursor-pointer',
                    isSelected
                      ? 'bg-accent text-white shadow-2xs'
                      : isDone
                        ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20'
                        : 'bg-surface-sunken text-content-muted border border-line'
                  )}
                >
                  <span>{formatDoseTime(dose.scheduledMinutes)}</span>
                  <span>{dose.medicineName.split(' ')[0]}</span>
                  {isDone && <Check size={11} className="stroke-[3]" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={nextIndex}
            className="p-2 rounded-xl bg-surface-sunken border border-line text-content hover:bg-surface-hover tap-spring"
            title="Next dose"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
