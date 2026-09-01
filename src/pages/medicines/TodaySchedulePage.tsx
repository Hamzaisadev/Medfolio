import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { Toast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { DateStrip } from '../../components/ui/DateStrip';
import { DoseCard } from '../../components/ui/DoseCard';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SLOT_META } from '../../components/ui/slotMeta';
import { PlusIcon, MedicineIcon } from '../../components/ui/icons';
import {
  AlertTriangle,
  Sparkles,
  Archive,
  Check,
} from 'lucide-react';
import { todayInAppTz, formatDayHeading } from '../../lib/time';
import { bucketOf, Bucket, BUCKET_ORDER } from '../../domain/timeBuckets';
import { deriveStatusOnRead, calculateAdherence } from '../../domain/adherence';
import { defaultDoseTimes, parseFrequency } from '../../domain/frequency';
import { buildSchedule } from '../../domain/schedule';
import { computeEndDate } from '../../domain/duration';
import { useAuth } from '../../lib/auth/AuthContext';
import { dosesRepo, medicinesRepo } from '../../lib/db';
import { decrementPill, incrementPill, readInventory } from '../../lib/inventory';
import type { Tables } from '../../lib/supabase/types';

type Dose = Tables<'doses'>;
type Medicine = Tables<'medicines'>;
type ScheduleFilter = 'all' | 'actionable' | 'taken';

const SKIP_REASONS = [
  'Forgot',
  'Side effect',
  'Doctor told me to stop',
  'Out of stock',
  'Other',
] as const;

/**
 * Creates the missing dose rows for `dateStr` for every medicine whose course
 * genuinely covers that date. Returns true if anything was written.
 */
async function topUpScheduleFor(
  medicines: Medicine[],
  dateStr: string,
  userId: string,
  profileId: string
): Promise<boolean> {
  const rows: Array<{
    user_id: string;
    profile_id: string;
    medicine_id: string;
    scheduled_date: string;
    scheduled_minutes: number;
    status: 'pending';
  }> = [];

  for (const m of medicines) {
    if (m.discontinued_at) continue;
    const effectiveStartDate = m.start_date || todayInAppTz();
    if (effectiveStartDate > dateStr) continue;

    const isOngoing = m.is_ongoing ?? false;
    const effectiveEndDate =
      m.end_date || (m.duration_days ? computeEndDate(effectiveStartDate, m.duration_days) : null);

    if (!isOngoing && effectiveEndDate && effectiveEndDate < dateStr) continue;

    const freqCode = m.frequency_code ?? parseFrequency(m.frequency_raw);
    if (!freqCode) continue;

    const doseTimes = defaultDoseTimes(freqCode, m.with_food, m.frequency_raw);
    if (doseTimes.length === 0) continue;

    const generated = buildSchedule({
      medicineId: m.id,
      startDate: effectiveStartDate,
      durationDays: m.duration_days,
      isOngoing,
      doseTimes,
      now: new Date(),
      frequencyCode: freqCode,
    });

    for (const slot of generated) {
      if (slot.scheduled_date !== dateStr) continue;
      rows.push({
        user_id: userId,
        profile_id: profileId,
        medicine_id: m.id,
        scheduled_date: slot.scheduled_date,
        scheduled_minutes: slot.scheduled_minutes,
        status: 'pending',
      });
    }
  }

  if (rows.length === 0) return false;
  await dosesRepo.createDoses(rows);
  return true;
}

export function TodaySchedulePage() {
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(todayInAppTz());
  const [doses, setDoses] = useState<Dose[]>([]);
  const [medicinesMap, setMedicinesMap] = useState<Record<string, Medicine>>({});
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>('all');

  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [activeDoseForSkip, setActiveDoseForSkip] = useState<Dose | null>(null);
  const [selectedSkipReason, setSelectedSkipReason] = useState<string>(SKIP_REASONS[0]);

  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'risk' } | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(
    async (dateStr: string) => {
      if (!effectiveProfileId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const [fetchedDoses, fetchedMeds] = await Promise.all([
          dosesRepo.listDosesForDate(effectiveProfileId, dateStr),
          medicinesRepo.listMedicines(effectiveProfileId),
        ]);

        const map: Record<string, Medicine> = {};
        for (const m of fetchedMeds) map[m.id] = m;
        setMedicinesMap(map);

        setInventory(readInventory(effectiveProfileId));

        const today = todayInAppTz();
        if (fetchedDoses.length === 0 && fetchedMeds.length > 0 && dateStr >= today) {
          const created = await topUpScheduleFor(
            fetchedMeds,
            dateStr,
            effectiveUserId,
            effectiveProfileId
          );
          setDoses(
            created ? await dosesRepo.listDosesForDate(effectiveProfileId, dateStr) : fetchedDoses
          );
          return;
        }

        setDoses(fetchedDoses);
      } catch (err) {
        console.warn('Error loading schedule:', err);
        setDoses([]);
        setLoadError(
          err instanceof Error ? err.message : 'Could not load your schedule for this day.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveUserId, effectiveProfileId]
  );

  useEffect(() => {
    loadData(selectedDate);
  }, [loadData, selectedDate]);

  const handleMarkTaken = async (dose: Dose) => {
    if (dose.status === 'taken') return;

    try {
      const updated = await dosesRepo.updateDoseStatus(dose.id, 'taken');
      setDoses((prev) => prev.map((d) => (d.id === dose.id ? updated : d)));

      const remaining = decrementPill(effectiveProfileId, dose.medicine_id);
      setInventory(readInventory(effectiveProfileId));

      setToast({
        tone: 'ok',
        message:
          remaining === null
            ? 'Dose marked as taken.'
            : `Dose marked as taken — ${remaining} left in your cabinet.`,
      });
    } catch (err: unknown) {
      console.error(err);
      setToast({
        tone: 'risk',
        message: err instanceof Error ? err.message : 'Could not record this dose. Please try again.',
      });
    }
  };

  /** Batch action to mark all due doses in a specific routine slot as taken */
  const handleMarkRoutineTaken = async (routineDoses: Dose[], routineName: string) => {
    const actionable = routineDoses.filter(
      (d) => deriveStatusOnRead(d, new Date()) === 'pending' || deriveStatusOnRead(d, new Date()) === 'missed'
    );
    if (actionable.length === 0) return;

    try {
      const updatedList = await Promise.all(
        actionable.map((d) => dosesRepo.updateDoseStatus(d.id, 'taken'))
      );

      for (const d of actionable) {
        decrementPill(effectiveProfileId, d.medicine_id);
      }
      setInventory(readInventory(effectiveProfileId));

      const updatedMap = new Map(updatedList.map((d) => [d.id, d]));
      setDoses((prev) => prev.map((d) => updatedMap.get(d.id) || d));

      setToast({
        tone: 'ok',
        message: `Marked ${actionable.length} ${routineName.toLowerCase()} doses as taken.`,
      });
    } catch (err: unknown) {
      console.error(err);
      setToast({
        tone: 'risk',
        message: 'Could not complete batch update. Please try marking individually.',
      });
    }
  };

  const handleUndo = async (dose: Dose) => {
    try {
      const updated = await dosesRepo.updateDoseStatus(dose.id, 'pending');
      setDoses((prev) => prev.map((d) => (d.id === dose.id ? updated : d)));

      if (dose.status === 'taken') {
        incrementPill(effectiveProfileId, dose.medicine_id);
        setInventory(readInventory(effectiveProfileId));
      }
      setToast({ tone: 'ok', message: 'Dose reset to pending.' });
    } catch (err: unknown) {
      console.error(err);
      setToast({
        tone: 'risk',
        message: err instanceof Error ? err.message : 'Could not update this dose. Please try again.',
      });
    }
  };

  const handleOpenSkip = (dose: Dose) => {
    setActiveDoseForSkip(dose);
    setSelectedSkipReason(SKIP_REASONS[0]);
    setSkipDialogOpen(true);
  };

  const handleConfirmSkip = async () => {
    if (!activeDoseForSkip) return;
    try {
      const updated = await dosesRepo.updateDoseStatus(
        activeDoseForSkip.id,
        'skipped',
        null,
        selectedSkipReason
      );
      setDoses((prev) => prev.map((d) => (d.id === activeDoseForSkip.id ? updated : d)));
      setSkipDialogOpen(false);
      setToast({ tone: 'ok', message: `Dose marked as skipped (${selectedSkipReason}).` });
    } catch (err: unknown) {
      console.error(err);
      setToast({
        tone: 'risk',
        message: err instanceof Error ? err.message : 'Could not record this dose. Please try again.',
      });
    }
  };

  const today = todayInAppTz();
  const isPast = selectedDate < today;

  // Filtered doses based on active filter tab
  const filteredDoses = useMemo(() => {
    return doses.filter((d) => {
      const status = deriveStatusOnRead(d, new Date());
      if (activeFilter === 'actionable') {
        return status === 'pending' || status === 'missed';
      }
      if (activeFilter === 'taken') {
        return status === 'taken' || status === 'skipped';
      }
      return true;
    });
  }, [doses, activeFilter]);

  const buckets: Record<Bucket, Dose[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  for (const d of filteredDoses) {
    buckets[bucketOf(d.scheduled_minutes)].push(d);
  }
  for (const key of BUCKET_ORDER) {
    buckets[key].sort((a, b) => a.scheduled_minutes - b.scheduled_minutes);
  }

  const adherence = calculateAdherence(
    doses.map((d) => ({
      id: d.id,
      medicine_id: d.medicine_id,
      scheduled_date: d.scheduled_date,
      scheduled_minutes: d.scheduled_minutes,
      status: d.status,
      taken_at: d.taken_at,
    })),
    { from: selectedDate, to: selectedDate },
    new Date()
  );

  const takenCount = doses.filter((d) => d.status === 'taken').length;
  const missedCount = doses.filter((d) => deriveStatusOnRead(d, new Date()) === 'missed').length;
  const pendingCount = doses.filter((d) => deriveStatusOnRead(d, new Date()) === 'pending').length;
  const actionableCount = pendingCount + missedCount;

  return (
    <AppShell>
      {/* Executive Page Header with Timezone Indicator */}
      <PageHeader
        title="Medication Schedule"
        description="Chronotherapy-timed daily doses. Tap any medicine circle to record a dose instantly."
        action={
          <Link to="/medicines/cabinet">
            <Button
              variant="secondary"
              leftIcon={<MedicineIcon size={16} />}
              className="h-10 text-xs font-bold tap-spring shadow-2xs"
            >
              Medicine Cabinet
            </Button>
          </Link>
        }
      />

      {toast && (
        <Toast
          open
          onClose={() => setToast(null)}
          message={toast.message}
          tone={toast.tone}
        />
      )}

      {/* Compact Date Navigator Strip */}
      <DateStrip value={selectedDate} onChange={setSelectedDate} className="mb-4" />

      {/* Streamlined Daily Clinical Intelligence Bar */}
      {!isLoading && doses.length > 0 && (
        <Card className="mb-5 p-4 sm:p-5 shadow-xs border border-line bg-surface-raised rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Left: Mini Progress Ring + Date & Status */}
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <ProgressRing
                  percentage={adherence.percentage}
                  size={54}
                  strokeWidth={6}
                  tone={adherence.percentage >= 80 ? 'ok' : 'warn'}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-content tracking-tight">
                    {formatDayHeading(selectedDate)}
                  </h2>
                  {adherence.percentage === 100 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-400 text-xs font-semibold">
                      <Sparkles size={11} />
                      All Complete
                    </span>
                  )}
                  {adherence.missed > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                      <AlertTriangle size={11} />
                      {adherence.missed} Overdue
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-xs text-content-muted">
                  {adherence.percentage === 100
                    ? 'All scheduled doses for this day are accounted for.'
                    : `${takenCount} of ${doses.length} taken · ${pendingCount} pending`}
                </p>
              </div>
            </div>

            {/* Right: Quick Segmented Filter */}
            <div className="w-full md:w-auto shrink-0">
              <SegmentedControl<ScheduleFilter>
                value={activeFilter}
                onChange={setActiveFilter}
                size="sm"
                options={[
                  { value: 'all', label: `All (${doses.length})` },
                  { value: 'actionable', label: `Due (${actionableCount})` },
                  { value: 'taken', label: `Taken (${takenCount})` },
                ]}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState
          title="Could not load this day"
          message={loadError}
          onRetry={() => loadData(selectedDate)}
        />
      ) : doses.length === 0 ? (
        <EmptyState
          heading={isPast ? 'No records for this day' : 'No doses scheduled'}
          description={
            isPast
              ? 'There are no medication records recorded for this date.'
              : 'Scan a prescription or add your active medicines to automatically generate your chronotherapy schedule.'
          }
          action={
            !isPast ? (
              <Link to="/prescriptions/new">
                <Button leftIcon={<PlusIcon size={17} />} className="tap-spring">
                  Scan a prescription
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : filteredDoses.length === 0 ? (
        <div className="p-8 rounded-2xl border border-line bg-surface-raised text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-surface-sunken mx-auto flex items-center justify-center text-content-subtle">
            <Archive size={22} />
          </div>
          <h3 className="text-base font-bold text-content">No doses match this filter</h3>
          <p className="text-xs text-content-muted max-w-sm mx-auto">
            {activeFilter === 'actionable'
              ? 'Great work! You have no pending or overdue doses for this day.'
              : 'No completed or skipped doses recorded under this filter.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => setActiveFilter('all')}>
            Show all doses
          </Button>
        </div>
      ) : (
        /* Chronotherapy Timed Routine Decks (Space-Efficient Grouped Views) */
        <div className="space-y-5">
          {BUCKET_ORDER.map((key) => {
            const bucketDoses = buckets[key];
            if (bucketDoses.length === 0) return null;
            const slot = SLOT_META[key];
            const bucketPending = bucketDoses.filter(
              (d) => deriveStatusOnRead(d, new Date()) === 'pending' || deriveStatusOnRead(d, new Date()) === 'missed'
            ).length;

            return (
              <section
                key={key}
                aria-labelledby={`slot-${key}`}
                className="rounded-2xl border border-line bg-surface-raised shadow-xs overflow-hidden transition-all"
              >
                {/* Routine Group Header Bar */}
                <div className="p-3 sm:p-3.5 px-4 sm:px-5 flex items-center justify-between gap-3 border-b border-line bg-surface-sunken/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={clsx(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs',
                        slot.surface,
                        slot.text,
                        slot.border
                      )}
                    >
                      {slot.icon(15)}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 id={`slot-${key}`} className="text-sm font-bold text-content tracking-tight uppercase">
                        {slot.label} Routine
                      </h2>
                      <span className="text-[11px] text-content-subtle font-semibold px-2 py-0.5 rounded-md bg-surface-raised border border-line">
                        {slot.timeRange}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {bucketPending > 1 && !isPast && (
                      <button
                        type="button"
                        onClick={() => handleMarkRoutineTaken(bucketDoses, slot.label)}
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-500/20 transition-all cursor-pointer tap-spring"
                      >
                        <Check size={12} />
                        Take all due ({bucketPending})
                      </button>
                    )}

                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full border text-[11px] font-semibold',
                        bucketPending > 0
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                          : 'bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400'
                      )}
                    >
                      {bucketPending > 0 ? `${bucketPending} of ${bucketDoses.length} due` : 'All completed ✓'}
                    </span>
                  </div>
                </div>

                {/* Divided Clean Medication Rows */}
                <div className="divide-y divide-line/40">
                  {bucketDoses.map((dose) => {
                    const medicine = medicinesMap[dose.medicine_id];
                    return (
                      <DoseCard
                        key={dose.id}
                        variant="row"
                        medicineName={medicine?.medicine_name || 'Prescribed medicine'}
                        strength={medicine?.strength}
                        doseAmount={medicine?.dose_amount}
                        scheduledMinutes={dose.scheduled_minutes}
                        status={deriveStatusOnRead(dose, new Date())}
                        withFood={medicine?.with_food}
                        instructions={medicine?.instructions}
                        skippedReason={dose.skipped_reason}
                        remaining={inventory[dose.medicine_id]}
                        onTake={() => handleMarkTaken(dose)}
                        onSkip={() => handleOpenSkip(dose)}
                        onUndo={() => handleUndo(dose)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Skip Reason Recording Dialog */}
      <Dialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        title="Record Reason for Skipping Dose"
        description="Recording a reason ensures clinical accuracy for your attending physician and adherence analytics."
      >
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            {SKIP_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedSkipReason === reason
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                    : 'border-line hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="skipReason"
                  value={reason}
                  checked={selectedSkipReason === reason}
                  onChange={(e) => setSelectedSkipReason(e.target.value)}
                  className="accent-accent w-4 h-4 cursor-pointer"
                />
                <span className="text-sm font-semibold text-content">{reason}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-line">
            <Button
              variant="ghost"
              onClick={() => setSkipDialogOpen(false)}
              className="text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmSkip}
              className="text-xs font-bold tap-spring"
            >
              Confirm Skip
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
