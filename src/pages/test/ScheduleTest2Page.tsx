import { useState } from 'react';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { TestDesignNavbar } from './TestDesignNavbar';
import { useTestScheduleData } from './useTestScheduleData';
import { formatDoseTime, minutesInAppTz } from '../../lib/time';
import { Bucket, BUCKET_ORDER } from '../../domain/timeBuckets';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  RotateCcw,
  Clock,
  Compass,
  Package,
  Utensils,
  Droplets,
  Radio,
} from 'lucide-react';

export function ScheduleTest2Page() {
  const {
    doses,
    groupedBuckets,
    takenCount,
    totalCount,
    adherencePercent,
    handleTake,
    handleUndo,
    handleBatchTake,
  } = useTestScheduleData();

  const [activeBucket, setActiveBucket] = useState<Bucket>('morning');
  const nowMinutes = minutesInAppTz();
  const currentAngle = (nowMinutes / 1440) * 360;

  const currentDoses = groupedBuckets[activeBucket];

  return (
    <AppShell>
      <TestDesignNavbar currentId={2} />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top 24-Hour Radar Visualizer Section */}
        <div className="p-6 rounded-3xl bg-surface-raised border border-line shadow-sm relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: Circular 24-Hour Clock Dial */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 border-line/60 bg-surface-sunken/40 flex items-center justify-center shadow-inner">
                {/* 24h Axis Hour Ticks */}
                {[0, 6, 12, 18].map((hr) => {
                  const angle = (hr / 24) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const x = Math.cos(rad) * 92;
                  const y = Math.sin(rad) * 92;
                  return (
                    <span
                      key={hr}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className="absolute text-[10px] font-black text-content-subtle"
                    >
                      {hr === 0 ? '12A' : hr === 6 ? '6A' : hr === 12 ? '12P' : '6P'}
                    </span>
                  );
                })}

                {/* Sweeping Current Hour Hand */}
                <div
                  style={{ transform: `rotate(${currentAngle}deg)` }}
                  className="absolute w-1 h-24 bg-accent/40 rounded-full origin-bottom bottom-1/2 shadow-xs transition-transform duration-500"
                />

                {/* Center Hub */}
                <div className="w-20 h-20 rounded-full bg-surface-raised border-2 border-line shadow-md flex flex-col items-center justify-center text-center z-10">
                  <span className="text-[10px] font-bold text-content-subtle uppercase">
                    Adherence
                  </span>
                  <span className="text-xl font-black text-content leading-none mt-0.5">
                    {adherencePercent}%
                  </span>
                  <span className="text-[9px] text-teal-600 font-bold">
                    {takenCount}/{totalCount} done
                  </span>
                </div>

                {/* Dose Radar Markers */}
                {doses.map((dose) => {
                  const angle = (dose.scheduledMinutes / 1440) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const x = Math.cos(rad) * 105;
                  const y = Math.sin(rad) * 105;
                  const isTaken = dose.status === 'taken';

                  return (
                    <button
                      key={dose.id}
                      type="button"
                      onClick={() => setActiveBucket(dose.bucket)}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className={clsx(
                        'absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border shadow-2xs cursor-pointer transition-transform hover:scale-125 z-20',
                        isTaken
                          ? 'bg-teal-600 border-teal-700 text-white'
                          : 'bg-amber-500 border-amber-600 text-white ring-2 ring-amber-300 animate-pulse'
                      )}
                      title={`${dose.medicineName} (${formatDoseTime(dose.scheduledMinutes)})`}
                    >
                      {isTaken ? '✓' : '!'}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-content-subtle font-semibold">
                <Radio size={12} className="text-accent animate-pulse" />
                <span>24-Hour Chrono Radar Active</span>
              </div>
            </div>

            {/* Right: Daypart Selector Tabs */}
            <div className="md:col-span-7 space-y-3">
              <h2 className="text-base font-bold text-content flex items-center gap-2">
                <Compass size={16} className="text-accent" /> Select Routine Segment
              </h2>

              <div className="grid grid-cols-2 gap-2.5">
                {BUCKET_ORDER.map((key) => {
                  const slot = SLOT_META[key];
                  const bucketDoses = groupedBuckets[key];
                  const isSelected = activeBucket === key;
                  const pending = bucketDoses.filter(
                    (d) => d.status === 'pending' || d.status === 'missed'
                  ).length;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveBucket(key)}
                      className={clsx(
                        'p-3.5 rounded-2xl border text-left transition-all tap-spring cursor-pointer',
                        isSelected
                          ? 'bg-accent/10 border-accent ring-2 ring-accent/20 shadow-xs'
                          : 'bg-surface-sunken/60 hover:bg-surface-hover border-line'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={clsx(
                            'w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs',
                            slot.surface,
                            slot.text
                          )}
                        >
                          {slot.icon(14)}
                        </span>
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded-md text-[10px] font-bold',
                            pending === 0
                              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                              : 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                          )}
                        >
                          {pending === 0 ? 'Done' : `${pending} due`}
                        </span>
                      </div>
                      <div className="mt-2">
                        <h4 className="text-xs font-bold text-content uppercase tracking-tight">
                          {slot.label}
                        </h4>
                        <span className="text-[11px] text-content-subtle font-medium">
                          {bucketDoses.length} medications
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Routine Med Stream */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-content uppercase tracking-tight">
              {SLOT_META[activeBucket].label} Routine Medications
            </h3>

            {currentDoses.some(
              (d) => d.status === 'pending' || d.status === 'missed'
            ) && (
              <button
                type="button"
                onClick={() => handleBatchTake(activeBucket)}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs tap-spring cursor-pointer"
              >
                Mark all {SLOT_META[activeBucket].label} taken ✓
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentDoses.map((dose) => {
              const isTaken = dose.status === 'taken';
              return (
                <div
                  key={dose.id}
                  className={clsx(
                    'p-4 rounded-2xl border bg-surface-raised shadow-2xs hover:shadow-card-hover transition-all flex flex-col justify-between space-y-3',
                    isTaken ? 'border-line/60 opacity-80' : 'border-line'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-accent bg-surface-sunken px-2 py-0.5 rounded-lg border border-line">
                        <Clock size={11} /> {formatDoseTime(dose.scheduledMinutes)}
                      </span>
                      <h4
                        className={clsx(
                          'text-base font-bold text-content mt-1.5',
                          isTaken && 'line-through text-content-muted'
                        )}
                      >
                        {dose.medicineName}
                      </h4>
                      <p className="text-xs text-content-muted font-medium">
                        {dose.strength} · {dose.doseAmount}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-content-subtle flex items-center gap-1 justify-end">
                        <Package size={11} /> {dose.remaining} in stock
                      </span>
                    </div>
                  </div>

                  {dose.instructions && (
                    <p className="text-[11px] text-content-muted bg-surface-sunken p-2 rounded-xl border border-line/40">
                      {dose.instructions}
                    </p>
                  )}

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between">
                    <div className="text-[11px] font-bold text-content-subtle flex items-center gap-1">
                      {dose.withFood === true ? (
                        <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1">
                          <Utensils size={11} /> With food
                        </span>
                      ) : dose.withFood === false ? (
                        <span className="text-blue-800 dark:text-blue-300 flex items-center gap-1">
                          <Droplets size={11} /> Empty stomach
                        </span>
                      ) : (
                        <span>As directed</span>
                      )}
                    </div>

                    {!isTaken ? (
                      <button
                        type="button"
                        onClick={() => handleTake(dose.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-2xs tap-spring cursor-pointer"
                      >
                        Take Dose
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                          Done ✓
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndo(dose.id)}
                          className="text-xs text-content-subtle hover:text-content"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
