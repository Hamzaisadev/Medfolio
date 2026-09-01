import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
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
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  PlusIcon,
  MedicineIcon,
  CheckIcon,
  AlertTriangleIcon,
} from '../../components/ui/icons';
import { todayInAppTz, formatDayHeading } from '../../lib/time';
import { bucketOf, Bucket, BUCKET_ORDER } from '../../domain/timeBuckets';
import { deriveStatusOnRead, calculateAdherence } from '../../domain/adherence';
import { defaultDoseTimes, parseFrequency } from '../../domain/frequency';
import { buildSchedule } from '../../domain/schedule';
import { computeEndDate } from '../../domain/duration';
import { useAuth } from '../../lib/auth/AuthContext';
import { dosesRepo, medicinesRepo } from '../../lib/db';
import { decrementPill, incrementPill } from '../../lib/inventory';
import { staggerContainer, staggerItem } from '../../lib/motion';
import type { Tables } from '../../lib/supabase/types';

type Dose = Tables<'doses'>;
type Medicine = Tables<'medicines'>;

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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [activeDoseForSkip, setActiveDoseForSkip] = useState<Dose | null>(null);
  const [selectedSkipReason, setSelectedSkipReason] = useState<string>(SKIP_REASONS[0]);

  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'risk' } | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(
    async (targetDate: string) => {
      if (!effectiveProfileId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const [medsList, initialDoses] = await Promise.all([
          medicinesRepo.listMedicines(effectiveProfileId),
          dosesRepo.listDosesForDate(effectiveProfileId, targetDate),
        ]);

        const map: Record<string, Medicine> = {};
        for (const m of medsList) map[m.id] = m;
        setMedicinesMap(map);

        if (initialDoses.length === 0 && medsList.length > 0) {
          const created = await topUpScheduleFor(
            medsList,
            targetDate,
            effectiveUserId,
            effectiveProfileId
          );
          if (created) {
            const refreshed = await dosesRepo.listDosesForDate(effectiveProfileId, targetDate);
            setDoses(refreshed);
            return;
          }
        }
        setDoses(initialDoses);
      } catch (err) {
        console.error('Failed to load schedule:', err);
        setLoadError('Failed to load schedule for this date.');
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveProfileId, effectiveUserId]
  );

  useEffect(() => {
    loadData(selectedDate);
  }, [loadData, selectedDate]);

  const handleMarkTaken = async (dose: Dose) => {
    const prev = doses;
    const nowIso = new Date().toISOString();
    setDoses((curr) =>
      curr.map((d) => (d.id === dose.id ? { ...d, status: 'taken', taken_at: nowIso } : d))
    );

    try {
      await dosesRepo.updateDoseStatus(dose.id, 'taken', nowIso);
      decrementPill(effectiveProfileId, dose.medicine_id);
      setToast({ message: 'Dose logged as taken', tone: 'ok' });
    } catch {
      setDoses(prev);
      setToast({ message: 'Could not log dose. Check connection.', tone: 'risk' });
    }
  };

  const handleMarkAllSlotTaken = async (slotDoses: Dose[]) => {
    const actionable = slotDoses.filter((d) => {
      const st = deriveStatusOnRead(d, new Date());
      return st === 'pending' || st === 'missed';
    });

    if (actionable.length === 0) return;

    const prev = doses;
    const nowIso = new Date().toISOString();
    const actionableIds = new Set(actionable.map((d) => d.id));

    setDoses((curr) =>
      curr.map((d) => (actionableIds.has(d.id) ? { ...d, status: 'taken', taken_at: nowIso } : d))
    );

    try {
      await Promise.all(
        actionable.map((d) => {
          decrementPill(effectiveProfileId, d.medicine_id);
          return dosesRepo.updateDoseStatus(d.id, 'taken', nowIso);
        })
      );
      setToast({ message: `Logged ${actionable.length} doses as taken`, tone: 'ok' });
    } catch {
      setDoses(prev);
      setToast({ message: 'Could not complete batch update.', tone: 'risk' });
    }
  };

  const handleOpenSkip = (dose: Dose) => {
    setActiveDoseForSkip(dose);
    setSelectedSkipReason(SKIP_REASONS[0]);
    setSkipDialogOpen(true);
  };

  const handleConfirmSkip = async () => {
    if (!activeDoseForSkip) return;
    const dose = activeDoseForSkip;
    setSkipDialogOpen(false);

    const prev = doses;
    setDoses((curr) =>
      curr.map((d) =>
        d.id === dose.id
          ? { ...d, status: 'skipped', skipped_reason: selectedSkipReason }
          : d
      )
    );

    try {
      await dosesRepo.updateDoseStatus(dose.id, 'skipped', null, selectedSkipReason);
      setToast({ message: 'Dose marked as skipped', tone: 'ok' });
    } catch {
      setDoses(prev);
      setToast({ message: 'Could not update dose.', tone: 'risk' });
    }
  };

  const handleUndo = async (dose: Dose) => {
    const prev = doses;
    const previousStatus = dose.status;

    setDoses((curr) =>
      curr.map((d) =>
        d.id === dose.id
          ? { ...d, status: 'pending', taken_at: null, skipped_reason: null }
          : d
      )
    );

    try {
      await dosesRepo.updateDoseStatus(dose.id, 'pending', null, null);

      if (previousStatus === 'taken') {
        incrementPill(effectiveProfileId, dose.medicine_id);
      }
      setToast({ message: 'Dose reset to pending', tone: 'ok' });
    } catch {
      setDoses(prev);
      setToast({ message: 'Could not undo dose status.', tone: 'risk' });
    }
  };

  const buckets: Record<Bucket, Dose[]> = useMemo(() => {
    const res: Record<Bucket, Dose[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    for (const d of doses) {
      const b = bucketOf(d.scheduled_minutes);
      res[b].push(d);
    }
    for (const key of BUCKET_ORDER) {
      res[key].sort((a, b) => a.scheduled_minutes - b.scheduled_minutes);
    }
    return res;
  }, [doses]);

  const adherence = calculateAdherence(
    doses.map((d) => ({
      id: d.id,
      medicine_id: d.medicine_id,
      scheduled_date: d.scheduled_date,
      scheduled_minutes: d.scheduled_minutes,
      status: d.status,
      taken_at: d.taken_at,
      is_prn: medicinesMap[d.medicine_id]?.frequency_code === 'PRN',
    })),
    { from: selectedDate, to: selectedDate },
    new Date()
  );

  const isPast = selectedDate < todayInAppTz();
  const isToday = selectedDate === todayInAppTz();
  const takenCount = doses.filter((d) => d.status === 'taken').length;
  const missedCount = doses.filter((d) => deriveStatusOnRead(d, new Date()) === 'missed').length;
  const pendingCount = doses.filter((d) => deriveStatusOnRead(d, new Date()) === 'pending').length;

  return (
    <AppShell>
      <Toast
        open={Boolean(toast)}
        message={toast?.message || ''}
        tone={toast?.tone || 'ok'}
        onClose={() => setToast(null)}
      />

      <PageHeader
        title="Medication Schedule"
        description="Daily timetable organized by meal times and dayparts."
        action={
          <div className="flex items-center gap-2">
            <Link to="/medicines/cabinet">
              <Button variant="secondary" leftIcon={<MedicineIcon size={16} />}>
                Cabinet
              </Button>
            </Link>
            <Link to="/prescriptions/new">
              <Button leftIcon={<PlusIcon size={16} />}>Add Course</Button>
            </Link>
          </div>
        }
      />

      {/* Date Strip Navigator */}
      <DateStrip value={selectedDate} onChange={setSelectedDate} className="mb-6" />

      {/* Modern Day Adherence & Progress Command Hub */}
      {!isLoading && doses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="p-5 sm:p-6 bg-surface-raised border border-line shadow-card overflow-hidden relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              {/* Left: Ring & Completion Label */}
              <div className="flex items-center gap-4.5">
                <ProgressRing
                  percentage={adherence.percentage}
                  size={68}
                  strokeWidth={7}
                  tone={adherence.percentage === 100 ? 'ok' : adherence.percentage >= 50 ? 'ok' : 'warn'}
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-content tracking-tight">
                      {formatDayHeading(selectedDate)}
                    </h2>
                    {isToday && (
                      <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-accent-subtle text-accent border border-accent/20">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-content-muted">
                    {takenCount} of {doses.length} doses taken ({adherence.percentage}%)
                  </p>
                </div>
              </div>

              {/* Right: Quick Pill Metric Counters */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-ok-bg/50 border border-ok-border text-center">
                  <span className="block text-xs font-bold text-ok-text" data-numeric>
                    {takenCount} Taken
                  </span>
                </div>
                {pendingCount > 0 && (
                  <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-surface-sunken border border-line text-center">
                    <span className="block text-xs font-bold text-content-muted" data-numeric>
                      {pendingCount} Due
                    </span>
                  </div>
                )}
                {missedCount > 0 && (
                  <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-warn-bg text-warn-text border border-warn-border text-center flex items-center gap-1.5 justify-center">
                    <AlertTriangleIcon size={13} />
                    <span className="text-xs font-bold" data-numeric>
                      {missedCount} Overdue
                    </span>
                  </div>
                )}
                {adherence.percentage === 100 && doses.length > 0 && (
                  <div className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-ok-bg text-ok-text border border-ok-border text-center flex items-center gap-1.5 justify-center">
                    <CheckIcon size={14} className="stroke-[2.5]" />
                    <span className="text-xs font-bold">100% Completed</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-[var(--radius-xl)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius-xl)]" />
          <Skeleton className="h-40 w-full rounded-[var(--radius-xl)]" />
        </div>
      ) : loadError ? (
        <ErrorState
          title="Could not load schedule"
          message={loadError}
          onRetry={() => loadData(selectedDate)}
        />
      ) : doses.length === 0 ? (
        <EmptyState
          heading={isPast ? 'No doses recorded for this date' : 'No doses scheduled for today'}
          description={
            isPast
              ? 'There are no active medication courses logged for this date.'
              : 'Add your prescribed medicines to generate your personalized daily timetable.'
          }
          action={
            !isPast ? (
              <Link to="/prescriptions/new">
                <Button leftIcon={<PlusIcon size={16} />}>Scan Prescription</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDate}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {BUCKET_ORDER.map((key) => {
              const bucketDoses = buckets[key];
              if (bucketDoses.length === 0) return null;
              const slot = SLOT_META[key];

              const pendingInSlot = bucketDoses.filter((d) => {
                const st = deriveStatusOnRead(d, new Date());
                return st === 'pending' || st === 'missed';
              });
              const allSlotTaken = pendingInSlot.length === 0 && bucketDoses.length > 0;

              return (
                <motion.section key={key} variants={staggerItem} aria-labelledby={`slot-${key}`}>
                  {/* Slot Header Banner with Batch Action */}
                  <div className="flex items-center justify-between gap-3 mb-3 px-1">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-xl border ${slot.surface} ${slot.text} ${slot.border}`}
                      >
                        {slot.icon(16)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 id={`slot-${key}`} className="text-sm font-bold text-content">
                            {slot.label}
                          </h3>
                          <span className="text-xs text-content-subtle font-mono">
                            • {slot.timeRange}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Batch Action Pill / Slot Done status */}
                    <div>
                      {allSlotTaken ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-ok-text bg-ok-bg border border-ok-border px-2.5 py-1 rounded-lg">
                          <CheckIcon size={12} className="stroke-[2.5]" /> Done
                        </span>
                      ) : pendingInSlot.length > 1 && !isPast ? (
                        <button
                          type="button"
                          onClick={() => handleMarkAllSlotTaken(bucketDoses)}
                          className="text-xs font-bold text-accent hover:bg-accent-subtle border border-accent/30 hover:border-accent px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Take all {pendingInSlot.length}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-content-subtle" data-numeric>
                          {bucketDoses.length} {bucketDoses.length === 1 ? 'dose' : 'doses'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slot Dose Cards */}
                  <div className="space-y-3">
                    {bucketDoses.map((dose) => {
                      const medicine = medicinesMap[dose.medicine_id];
                      return (
                        <DoseCard
                          key={dose.id}
                          medicineName={medicine?.medicine_name || 'Prescribed medicine'}
                          strength={medicine?.strength}
                          doseAmount={medicine?.dose_amount}
                          scheduledMinutes={dose.scheduled_minutes}
                          status={deriveStatusOnRead(dose, new Date())}
                          withFood={medicine?.with_food}
                          instructions={medicine?.instructions}
                          skippedReason={dose.skipped_reason}
                          onTake={() => handleMarkTaken(dose)}
                          onSkip={() => handleOpenSkip(dose)}
                          onUndo={() => handleUndo(dose)}
                        />
                      );
                    })}
                  </div>
                </motion.section>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Skip Reason Dialog */}
      <Dialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        title="Reason for skipping dose"
        description="Logging a reason helps keep an accurate clinical history for your doctor."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {SKIP_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  selectedSkipReason === reason
                    ? 'border-accent bg-accent-subtle font-semibold text-content'
                    : 'border-line hover:bg-surface-hover text-content-muted'
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
                <span className="text-sm font-medium">{reason}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-line">
            <Button variant="ghost" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmSkip}>
              Confirm Skip
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
