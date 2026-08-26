import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SLOT_META } from '../../components/ui/slotMeta';
import { PlusIcon, MedicineIcon } from '../../components/ui/icons';
import { todayInAppTz, formatDayHeading } from '../../lib/time';
import { bucketOf, Bucket, BUCKET_ORDER } from '../../domain/timeBuckets';
import { deriveStatusOnRead, calculateAdherence } from '../../domain/adherence';
import { defaultDoseTimes, parseFrequency } from '../../domain/frequency';
import { buildSchedule } from '../../domain/schedule';
import { computeEndDate } from '../../domain/duration';
import { useAuth } from '../../lib/auth/AuthContext';
import { dosesRepo, medicinesRepo } from '../../lib/db';
import { decrementPill, incrementPill } from '../../lib/inventory';
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

    // frequency_code is the authority; frequency_raw is only a fallback.
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

        // Top up the schedule when a still-active course has no doses for a
        // present/future date — this is what keeps ongoing medicines going past
        // the 30-day generation horizon.
        //
        // Deliberately forward-only: generating rows for a past date invents an
        // adherence record for a day that already happened.
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
    // Guard against re-marking: the old "Change Status" button called this again
    // on an already-taken dose, decrementing the pill count on each click.
    if (dose.status === 'taken') return;

    try {
      const updated = await dosesRepo.updateDoseStatus(dose.id, 'taken');
      setDoses((prev) => prev.map((d) => (d.id === dose.id ? updated : d)));

      const remaining = decrementPill(effectiveProfileId, dose.medicine_id);
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

  /** Reverts a taken/skipped dose back to pending, restoring the pill count. */
  const handleUndo = async (dose: Dose) => {
    try {
      const updated = await dosesRepo.updateDoseStatus(dose.id, 'pending');
      setDoses((prev) => prev.map((d) => (d.id === dose.id ? updated : d)));

      if (dose.status === 'taken') {
        incrementPill(effectiveProfileId, dose.medicine_id);
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

  const buckets: Record<Bucket, Dose[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  for (const d of doses) {
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

  const today = todayInAppTz();
  const isPast = selectedDate < today;
  const takenCount = doses.filter((d) => d.status === 'taken').length;

  return (
    <AppShell>
      <PageHeader
        title="Your schedule"
        description="Doses are timed for Pakistan Standard Time. Mark each one as you take it."
        action={
          <Link to="/medicines/cabinet" className="hidden sm:block">
            <Button variant="secondary" leftIcon={<MedicineIcon size={17} />}>
              Medicine cabinet
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

      <DateStrip value={selectedDate} onChange={setSelectedDate} className="mb-5" />

      {/* Day summary. Only shown once something is actually scheduled, so an empty
          day does not display a 0% ring that reads as failure. */}
      {!isLoading && doses.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <ProgressRing
              percentage={adherence.percentage}
              size={60}
              strokeWidth={6}
              tone={adherence.percentage >= 80 ? 'ok' : 'warn'}
            />
            <div className="min-w-0">
              <p className="text-base font-bold text-content">
                {formatDayHeading(selectedDate)}
              </p>
              <p className="mt-0.5 text-sm text-content-muted">
                {takenCount} of {doses.length} doses taken
                {adherence.missed > 0 && ` · ${adherence.missed} overdue`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-[var(--radius-xl)]" />
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
          heading={isPast ? 'Nothing was scheduled this day' : 'No doses scheduled'}
          description={
            isPast
              ? 'There are no dose records for this date.'
              : 'Scan a prescription and your dose times are worked out for you.'
          }
          action={
            !isPast ? (
              <Link to="/prescriptions/new">
                <Button leftIcon={<PlusIcon size={17} />}>Scan a prescription</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {BUCKET_ORDER.map((key) => {
            const bucketDoses = buckets[key];
            if (bucketDoses.length === 0) return null;
            const slot = SLOT_META[key];

            return (
              <section key={key} aria-labelledby={`slot-${key}`}>
                <SectionHeader
                  title={slot.label}
                  icon={slot.icon(16)}
                  tone={slot.tone}
                  meta={slot.timeRange}
                  className="mb-4"
                />
                <h2 id={`slot-${key}`} className="sr-only">
                  {slot.label} doses
                </h2>

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
              </section>
            );
          })}
        </div>
      )}

      <Dialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        title="Why are you skipping this dose?"
        description="Recording a reason keeps your record accurate for your doctor."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {SKIP_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3.5 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                  selectedSkipReason === reason
                    ? 'border-accent bg-accent-subtle'
                    : 'border-line hover:bg-surface-hover'
                }`}
              >
                <input
                  type="radio"
                  name="skipReason"
                  value={reason}
                  checked={selectedSkipReason === reason}
                  onChange={(e) => setSelectedSkipReason(e.target.value)}
                  className="accent-accent w-4 h-4"
                />
                <span className="text-sm font-medium text-content">{reason}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-4 border-t border-line">
            <Button variant="ghost" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmSkip}>
              Confirm skip
            </Button>
          </div>
        </div>
      </Dialog>
    </AppShell>
  );
}
