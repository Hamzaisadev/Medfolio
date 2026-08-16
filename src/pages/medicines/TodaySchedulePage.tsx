import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { EmptyState } from '../../components/ui/EmptyState';
import { Dialog } from '../../components/ui/Dialog';
import { Toast } from '../../components/ui/Toast';
import { formatDoseTime, todayInAppTz, addDaysAppTz } from '../../lib/time';
import { bucketOf, Bucket } from '../../domain/timeBuckets';
import { deriveStatusOnRead, calculateAdherence } from '../../domain/adherence';
import { defaultDoseTimes, parseFrequency } from '../../domain/frequency';
import { useAuth } from '../../lib/auth/AuthContext';
import { dosesRepo, medicinesRepo } from '../../lib/db';
import type { Tables } from '../../lib/supabase/types';

type Dose = Tables<'doses'>;
type Medicine = Tables<'medicines'>;

export function TodaySchedulePage() {
  const { user, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(todayInAppTz());
  const [doses, setDoses] = useState<Dose[]>([]);
  const [medicinesMap, setMedicinesMap] = useState<Record<string, Medicine>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Skip Dialog state
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [activeDoseForSkip, setActiveDoseForSkip] = useState<Dose | null>(null);
  const [selectedSkipReason, setSelectedSkipReason] = useState<string>('Forgot');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const effectiveUserId = user?.id || profile?.user_id || '';
  const effectiveProfileId = profile?.id || effectiveUserId;

  const loadData = useCallback(async (dateStr: string) => {
    if (!effectiveUserId) return;
    setIsLoading(true);
    try {
      let [fetchedDoses, fetchedMeds] = await Promise.all([
        dosesRepo.listDosesForDate(effectiveProfileId, dateStr),
        medicinesRepo.listMedicines(effectiveProfileId),
      ]);

      const map: Record<string, Medicine> = {};
      for (const m of fetchedMeds) {
        map[m.id] = m;
      }
      setMedicinesMap(map);

      // Auto-recovery: If no doses are recorded for this date but active non-PRN medicines exist, generate them
      if (fetchedDoses.length === 0 && fetchedMeds.length > 0) {
        const dosesToCreate: Tables<'doses'>[] = [];
        const nowIso = new Date().toISOString();

        for (const m of fetchedMeds) {
          const isOngoing = m.is_ongoing ?? false;
          const isStarted = !m.start_date || m.start_date <= dateStr;
          const isNotEnded = isOngoing || !m.end_date || m.end_date >= dateStr;

          if (isStarted && isNotEnded && m.frequency_code !== 'PRN' && m.frequency_code !== 'SOS') {
            const freqCode = m.frequency_code || parseFrequency(m.frequency_raw) || 'OD';
            const times = defaultDoseTimes(freqCode, m.with_food ?? true, m.frequency_raw || 'OD');

            for (const minutes of times) {
              dosesToCreate.push({
                id: `dose-${Date.now()}-${m.id.slice(-4)}-${minutes}`,
                user_id: effectiveUserId,
                profile_id: effectiveProfileId,
                medicine_id: m.id,
                scheduled_date: dateStr,
                scheduled_minutes: minutes,
                status: 'pending',
                taken_at: null,
                skipped_reason: null,
                snoozed_until: null,
                created_at: nowIso,
                updated_at: nowIso,
              });
            }
          }
        }

        if (dosesToCreate.length > 0) {
          await dosesRepo.createDoses(dosesToCreate);
          fetchedDoses = await dosesRepo.listDosesForDate(effectiveProfileId, dateStr);
        }
      }

      setDoses(fetchedDoses);
    } catch (err) {
      console.warn('Error loading schedule:', err);
      setDoses([]);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveUserId, effectiveProfileId]);

  useEffect(() => {
    loadData(selectedDate);
  }, [loadData, selectedDate]);

  const handleMarkTaken = async (dose: Dose) => {
    try {
      await dosesRepo.updateDoseStatus(dose.id, 'taken');
      setDoses((prev) =>
        prev.map((d) => (d.id === dose.id ? { ...d, status: 'taken', taken_at: new Date().toISOString() } : d))
      );

      // Decrement pill count in cabinet inventory
      try {
        const saved = localStorage.getItem('medfolio_pill_inventory_v1');
        if (saved) {
          const inv = JSON.parse(saved);
          if (inv[dose.medicine_id] && inv[dose.medicine_id] > 0) {
            inv[dose.medicine_id] -= 1;
            localStorage.setItem('medfolio_pill_inventory_v1', JSON.stringify(inv));
          }
        }
      } catch (err) {
        console.error('Failed to update inventory:', err);
      }

      setToastMessage('Marked dose as taken (-1 pill from cabinet).');
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleOpenSkip = (dose: Dose) => {
    setActiveDoseForSkip(dose);
    setSelectedSkipReason('Forgot');
    setSkipDialogOpen(true);
  };

  const handleConfirmSkip = async () => {
    if (!activeDoseForSkip) return;
    try {
      await dosesRepo.updateDoseStatus(
        activeDoseForSkip.id,
        'skipped',
        null,
        selectedSkipReason
      );
      setDoses((prev) =>
        prev.map((d) =>
          d.id === activeDoseForSkip.id
            ? { ...d, status: 'skipped', skipped_reason: selectedSkipReason }
            : d
        )
      );
      setSkipDialogOpen(false);
      setToastMessage(`Dose marked as skipped (${selectedSkipReason}).`);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  // Group doses by bucket
  const buckets: Record<Bucket, Dose[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  for (const d of doses) {
    const bucket = bucketOf(d.scheduled_minutes);
    buckets[bucket].push(d);
  }

  // Calculate adherence
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

  const bucketMeta: Array<{ key: Bucket; label: string; timeWindow: string }> = [
    { key: 'morning', label: 'Morning', timeWindow: '05:00 – 11:59' },
    { key: 'afternoon', label: 'Afternoon', timeWindow: '12:00 – 16:59' },
    { key: 'evening', label: 'Evening', timeWindow: '17:00 – 20:59' },
    { key: 'night', label: 'Night', timeWindow: '21:00 – 04:59' },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Today's Schedule"
        description="Track and log prescribed medicines scheduled for today in Karachi (PKT)."
        action={
          <div className="flex items-center gap-2">
            <Link to="/prescriptions/new">
              <Button size="sm">Add Prescription</Button>
            </Link>
          </div>
        }
      />

      <Toast
        open={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
        tone="ok"
      />

      {/* Date Strip & Adherence Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-3 flex items-center justify-between p-3 rounded-[var(--radius-lg)] border border-ink-200 bg-white shadow-[var(--shadow-card)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(addDaysAppTz(selectedDate, -1))}
          >
            ← Previous Day
          </Button>

          <div className="text-center">
            <p className="text-xs text-ink-500 font-medium">Viewing Schedule for</p>
            <p className="text-base font-bold text-ink-900">{selectedDate}</p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(addDaysAppTz(selectedDate, 1))}
          >
            Next Day →
          </Button>
        </div>

        <div className="p-3 rounded-[var(--radius-lg)] border border-ink-200 bg-white shadow-[var(--shadow-card)] flex items-center justify-around">
          <div>
            <p className="text-xs text-ink-500 font-medium">Day Adherence</p>
            <p className="text-lg font-bold text-ink-900">
              {adherence.taken} of {adherence.scheduled} taken
            </p>
          </div>
          <ProgressRing percentage={adherence.percentage} size={52} strokeWidth={5} />
        </div>
      </div>

      {/* Time Buckets */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-ink-500">Loading scheduled doses...</div>
      ) : doses.length === 0 ? (
        <EmptyState
          heading="No doses scheduled for this date"
          description="You don't have any pending doses scheduled on this day. Capture a prescription to generate your schedule automatically."
          action={
            <Link to="/prescriptions/new">
              <Button size="sm">Add Prescription</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {bucketMeta.map(({ key, label, timeWindow }) => {
            const bucketDoses = buckets[key];
            if (bucketDoses.length === 0) return null;

            return (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-ink-200">
                  <h2 className="text-sm font-bold text-ink-900 uppercase tracking-wider">{label}</h2>
                  <span className="text-xs text-ink-500">{timeWindow}</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {bucketDoses.map((dose) => {
                    const medicine = medicinesMap[dose.medicine_id];
                    const derivedStatus = deriveStatusOnRead(
                      {
                        status: dose.status,
                        scheduled_date: dose.scheduled_date,
                        scheduled_minutes: dose.scheduled_minutes,
                      },
                      new Date()
                    );

                    return (
                      <Card key={dose.id} className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-ink-900">
                                {medicine?.medicine_name || 'Prescribed Medicine'}
                              </span>
                              {medicine?.strength && (
                                <span className="text-xs text-ink-600 font-medium">
                                  ({medicine.strength})
                                </span>
                              )}
                              {derivedStatus === 'taken' && <Badge tone="ok">Taken</Badge>}
                              {derivedStatus === 'skipped' && (
                                <Badge tone="neutral">Skipped: {dose.skipped_reason || 'Manual'}</Badge>
                              )}
                              {derivedStatus === 'missed' && <Badge tone="warn">Overdue</Badge>}
                            </div>

                            <p className="mt-1 text-xs text-ink-500">
                              Scheduled for {formatDoseTime(dose.scheduled_minutes)}
                              {medicine?.instructions && ` • ${medicine.instructions}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {derivedStatus === 'pending' || derivedStatus === 'missed' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenSkip(dose)}
                                >
                                  Skip
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleMarkTaken(dose)}
                                >
                                  Mark as Taken
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkTaken(dose)}
                              >
                                Change Status
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skip Reason Modal */}
      <Dialog
        open={skipDialogOpen}
        onOpenChange={setSkipDialogOpen}
        title="Reason for skipping dose"
        description="Recording a reason helps you and your doctor keep an accurate record."
      >
        <div className="space-y-4 pt-2">
          {['Forgot', 'Side effect', 'Doctor told me to stop', 'Out of stock', 'Other'].map(
            (reason) => (
              <label
                key={reason}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] border border-ink-200 hover:bg-ink-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="skipReason"
                  value={reason}
                  checked={selectedSkipReason === reason}
                  onChange={(e) => setSelectedSkipReason(e.target.value)}
                  className="text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-ink-900">{reason}</span>
              </label>
            )
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-ink-200">
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
