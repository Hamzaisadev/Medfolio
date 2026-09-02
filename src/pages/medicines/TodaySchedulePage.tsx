import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { Toast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { MedicineOrderModal } from '../../components/medicines/MedicineOrderModal';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '../../components/ui/icons';
import {
  Archive,
  Check,
  RotateCcw,
  ShieldCheck,
  Clock,
  Flame,
  Package,
  ArrowUpRight,
  Utensils,
  Droplets,
  AlertCircle,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import {
  todayInAppTz,
  fromAppDate,
  addDaysAppTz,
  formatRelativeDay,
  formatDateShort,
  formatDoseTime,
  minutesInAppTz,
} from '../../lib/time';
import { bucketOf, Bucket, BUCKET_ORDER } from '../../domain/timeBuckets';
import { deriveStatusOnRead } from '../../domain/adherence';
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

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedMedicineForOrder, setSelectedMedicineForOrder] = useState<Medicine | null>(null);

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
            : `Dose marked as taken — ${remaining} left in cabinet.`,
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

  const handleOpenOrderModal = (medicine: Medicine | undefined) => {
    if (!medicine) return;
    setSelectedMedicineForOrder(medicine);
    setOrderModalOpen(true);
  };

  const handleStockUpdated = (newStock: number) => {
    if (!selectedMedicineForOrder) return;
    setInventory((prev) => ({
      ...prev,
      [selectedMedicineForOrder.id]: newStock,
    }));
    setToast({
      tone: 'ok',
      message: `Cabinet updated: ${newStock} units of ${selectedMedicineForOrder.medicine_name} in stock.`,
    });
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

  const takenCount = doses.filter((d) => d.status === 'taken').length;
  const missedCount = doses.filter((d) => deriveStatusOnRead(d, new Date()) === 'missed').length;
  const pendingCount = doses.filter((d) => deriveStatusOnRead(d, new Date()) === 'pending').length;
  const actionableCount = pendingCount + missedCount;
  const totalCount = doses.length;
  const adherencePercent = totalCount === 0 ? 100 : Math.round((takenCount / totalCount) * 100);

  // Bento Hero: Next Actionable Dose Calculation
  const nowMinutes = minutesInAppTz();
  const outstandingDoses = useMemo(() => {
    return doses.filter((d) => {
      const s = deriveStatusOnRead(d, new Date());
      return s === 'pending' || s === 'missed';
    });
  }, [doses]);

  const nextDose = useMemo(() => {
    if (outstandingDoses.length === 0) return null;
    const upcoming = outstandingDoses.find((d) => d.scheduled_minutes >= nowMinutes);
    return upcoming || outstandingDoses[0];
  }, [outstandingDoses, nowMinutes]);

  const nextMedicine = nextDose ? medicinesMap[nextDose.medicine_id] : null;
  const nextMedicineStock = nextDose ? inventory[nextDose.medicine_id] : undefined;

  // Low stock medicines count across the schedule
  const lowStockCount = useMemo(() => {
    const uniqueMedIds = new Set(doses.map((d) => d.medicine_id));
    let count = 0;
    for (const id of uniqueMedIds) {
      const stock = inventory[id];
      if (stock !== undefined && stock <= 5) count++;
    }
    return count;
  }, [doses, inventory]);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [viewYear, setViewYear] = useState(() => {
    try {
      return fromAppDate(selectedDate).getUTCFullYear();
    } catch {
      return new Date().getFullYear();
    }
  });

  const [viewMonth, setViewMonth] = useState(() => {
    try {
      return fromAppDate(selectedDate).getUTCMonth();
    } catch {
      return new Date().getMonth();
    }
  });

  useEffect(() => {
    try {
      const d = fromAppDate(selectedDate);
      setViewYear(d.getUTCFullYear());
      setViewMonth(d.getUTCMonth());
    } catch {
      // ignore
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  const calendarMonthDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startDayIndex = (firstDay.getUTCDay() + 6) % 7;
    const totalDays = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    const prevMonthTotalDays = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const mm = String(prevM + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateStr: `${prevY}-${mm}-${dd}`, dayNum: d, isCurrentMonth: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateStr: `${viewYear}-${mm}-${dd}`, dayNum: d, isCurrentMonth: true });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const mm = String(nextM + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      cells.push({ dateStr: `${nextY}-${mm}-${dd}`, dayNum: d, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const displayDateLabel = useMemo(() => {
    const relative = formatRelativeDay(selectedDate);
    const shortDate = formatDateShort(selectedDate);
    if (relative === shortDate) return shortDate;
    return `${relative}, ${shortDate}`;
  }, [selectedDate]);

  return (
    <AppShell>
      {toast && (
        <Toast
          open
          onClose={() => setToast(null)}
          message={toast.message}
          tone={toast.tone}
        />
      )}

      {/* Bento Health OS Top Control Strip */}
      <div className="p-3 sm:p-4 px-4 sm:px-6 rounded-3xl bg-surface-raised border border-line shadow-2xs mb-6 overflow-visible relative z-30">
        <div className="flex items-center justify-between gap-4 w-full overflow-visible py-0.5 flex-wrap sm:flex-nowrap">
          {/* Left: App Title & Status */}
          <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-accent text-white flex items-center justify-center shrink-0 shadow-xs">
              <CalendarIcon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-content tracking-tight leading-tight whitespace-nowrap">
                Medication Schedule
              </h1>
              <p className="text-xs text-content-muted font-medium hidden sm:block whitespace-nowrap">
                Bento Health OS · Chronotherapy regimen
              </p>
            </div>
          </div>

          {/* Right: Date Stepper, Calendar Popover & Cabinet Link */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
            <div className="flex items-center gap-1 shrink-0" ref={calendarRef}>
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => setSelectedDate(addDaysAppTz(selectedDate, -1))}
                className="w-8 h-8 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line text-content-muted hover:text-content flex items-center justify-center tap-spring transition-all shrink-0"
              >
                <ChevronLeftIcon size={13} />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line text-content text-xs font-bold shadow-2xs tap-spring whitespace-nowrap transition-all"
                  aria-expanded={isCalendarOpen}
                  aria-label="Select date"
                >
                  <CalendarIcon size={13} className="text-accent" />
                  <span>{displayDateLabel}</span>
                  <ChevronDownIcon
                    size={11}
                    className={clsx('text-content-subtle transition-transform duration-200', isCalendarOpen && 'rotate-180')}
                  />
                </button>

                {/* Calendar Dropdown */}
                {isCalendarOpen && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3.5 rounded-2xl bg-surface-raised border border-line-strong shadow-raise z-50 text-content animate-in fade-in zoom-in-95 duration-150"
                    role="dialog"
                    aria-label="Select date from calendar"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={handlePrevMonth}
                        className="w-7 h-7 rounded-lg border border-line flex items-center justify-center text-content-muted hover:bg-surface-hover"
                      >
                        <ChevronLeftIcon size={14} />
                      </button>

                      <div className="text-xs font-bold text-content">
                        {MONTH_NAMES[viewMonth]} {viewYear}
                      </div>

                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={handleNextMonth}
                        className="w-7 h-7 rounded-lg border border-line flex items-center justify-center text-content-muted hover:bg-surface-hover"
                      >
                        <ChevronRightIcon size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                      {WEEKDAYS.map((wd) => (
                        <span key={wd} className="text-[10px] font-bold text-content-subtle uppercase">
                          {wd}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarMonthDays.map((cell) => {
                        const isSelected = cell.dateStr === selectedDate;
                        const isTodayCell = cell.dateStr === today;

                        return (
                          <button
                            key={cell.dateStr}
                            type="button"
                            onClick={() => {
                              setSelectedDate(cell.dateStr);
                              setIsCalendarOpen(false);
                            }}
                            className={clsx(
                              'h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all relative',
                              isSelected
                                ? 'bg-accent text-content-onaccent font-bold shadow-xs'
                                : cell.isCurrentMonth
                                  ? 'text-content hover:bg-surface-hover'
                                  : 'text-content-subtle opacity-40 hover:opacity-100 hover:bg-surface-hover',
                              isTodayCell && !isSelected && 'ring-1 ring-accent font-bold text-accent'
                            )}
                          >
                            {cell.dayNum}
                            {isTodayCell && !isSelected && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-line text-2xs">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(addDaysAppTz(selectedDate, -7));
                          setIsCalendarOpen(false);
                        }}
                        className="px-2 py-1 rounded-md text-content-muted hover:bg-surface-hover hover:text-content font-medium transition-colors"
                      >
                        ← Prev Week
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(today);
                          setIsCalendarOpen(false);
                        }}
                        className="px-2 py-1 rounded-md bg-accent-subtle text-accent font-bold hover:bg-accent hover:text-content-onaccent transition-colors"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(addDaysAppTz(selectedDate, 7));
                          setIsCalendarOpen(false);
                        }}
                        className="px-2 py-1 rounded-md text-content-muted hover:bg-surface-hover hover:text-content font-medium transition-colors"
                      >
                        Next Week →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                aria-label="Next day"
                onClick={() => setSelectedDate(addDaysAppTz(selectedDate, 1))}
                className="w-8 h-8 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line text-content-muted hover:text-content flex items-center justify-center tap-spring transition-all shrink-0"
              >
                <ChevronRightIcon size={13} />
              </button>
            </div>

            <Link
              to="/medicines/cabinet"
              aria-label="Medicine Cabinet"
              title="Medicine Cabinet"
              className="w-8 h-8 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line text-content-muted hover:text-content flex items-center justify-center tap-spring transition-all shrink-0"
            >
              <Archive size={14} />
            </Link>

            <Link to="/prescriptions/new">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={13} />}
                className="h-8 px-3 text-xs font-bold rounded-xl tap-spring shadow-2xs"
              >
                Scan Rx
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Stream */}
      <main className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-3xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-3xl" />
              ))}
            </div>
          </div>
        ) : loadError ? (
          <ErrorState
            title="Could not load schedule"
            message={loadError}
            onRetry={() => loadData(selectedDate)}
          />
        ) : doses.length === 0 ? (
          <EmptyState
            heading={isPast ? 'No records for this day' : 'No medications scheduled'}
            description={
              isPast
                ? 'There are no medication records recorded for this date.'
                : 'Scan a prescription or add active medicines to automatically generate your Bento Health OS schedule.'
            }
            action={
              !isPast ? (
                <Link to="/prescriptions/new">
                  <Button leftIcon={<Plus size={15} />} className="tap-spring">
                    Scan prescription
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Bento Grid Top Tier: Hero Next Due Widget + Adherence/Streak Hub */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Bento 1: Hero Next Due Medication Card (7 Cols) */}
              <div className="lg:col-span-7 p-6 rounded-3xl bg-linear-to-br from-teal-900 to-emerald-950 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider text-emerald-200 border border-white/10">
                      <ShieldCheck size={13} className="text-amber-300" />
                      {nextDose ? (
                        deriveStatusOnRead(nextDose, new Date()) === 'missed'
                          ? 'Overdue Administration'
                          : 'Next Due Administration'
                      ) : (
                        'All Doses Completed'
                      )}
                    </span>

                    {nextDose && (
                      <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                        <Clock size={12} /> {formatDoseTime(nextDose.scheduled_minutes)}
                      </span>
                    )}
                  </div>

                  {nextDose && nextMedicine ? (
                    <div className="mt-5 space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                        {nextMedicine.medicine_name}
                      </h2>
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-100/90 flex-wrap">
                        {nextMedicine.strength && <span>{nextMedicine.strength}</span>}
                        {nextMedicine.strength && <span>·</span>}
                        <span>{nextMedicine.dose_amount || (nextMedicine.form ? `1 ${nextMedicine.form}` : '1 dose')}</span>
                        <span>·</span>
                        {nextMedicine.with_food === true ? (
                          <span className="inline-flex items-center gap-1 text-amber-200 font-bold">
                            <Utensils size={12} /> With food
                          </span>
                        ) : nextMedicine.with_food === false ? (
                          <span className="inline-flex items-center gap-1 text-sky-200 font-bold">
                            <Droplets size={12} /> Empty stomach
                          </span>
                        ) : (
                          <span>As directed</span>
                        )}
                      </div>

                      {nextMedicine.instructions && (
                        <p className="text-xs text-emerald-100/80 bg-white/10 p-2.5 rounded-2xl backdrop-blur-xs max-w-lg mt-3 leading-relaxed">
                          {nextMedicine.instructions}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 py-4 space-y-1">
                      <h3 className="text-xl sm:text-2xl font-black text-emerald-100">
                        All Caught Up For Today! 🎉
                      </h3>
                      <p className="text-xs text-emerald-200/80">
                        All scheduled medications for {displayDateLabel} have been completed.
                      </p>
                    </div>
                  )}
                </div>

                {nextDose && (
                  <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between gap-4 relative z-10 flex-wrap">
                    <span className="text-xs text-emerald-200 font-semibold flex items-center gap-1.5">
                      <Package size={13} />
                      {nextMedicineStock !== undefined
                        ? nextMedicineStock === 0
                          ? 'Out of stock in cabinet'
                          : `${nextMedicineStock} left in cabinet`
                        : 'Stock tracked'}
                    </span>

                    {!isPast && (
                      <button
                        type="button"
                        onClick={() => handleMarkTaken(nextDose)}
                        className="px-6 py-2.5 rounded-2xl bg-white text-teal-950 font-black text-xs hover:bg-emerald-50 shadow-lg tap-spring cursor-pointer flex items-center gap-2"
                      >
                        <Check size={16} className="stroke-[3] text-teal-700" />
                        Log Taken Now
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bento 2: Adherence Score & Inventory Hub (5 Cols) */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                {/* Adherence Score Box */}
                <div className="p-5 rounded-3xl bg-surface-raised border border-line shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-content-subtle uppercase tracking-wider">
                      Adherence Score
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

                {/* Streak Box */}
                <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/20 shadow-2xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase flex items-center gap-1">
                      <Flame size={13} className="text-amber-600 fill-amber-600" />
                      Active Streak
                    </span>
                    <div className="text-3xl font-black text-amber-950 dark:text-amber-100 mt-1">
                      {takenCount > 0 ? `${takenCount} Doses` : 'Today'}
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mt-0.5">
                      {adherencePercent >= 80 ? 'Optimal Adherence' : 'Active Plan'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg self-start">
                    {adherencePercent === 100 ? 'Gold Tier ⭐' : 'In Progress'}
                  </span>
                </div>

                {/* Cabinet Stock Health Widget (Full Width below stats) */}
                <div className="col-span-2 p-4 rounded-3xl bg-surface-raised border border-line shadow-2xs flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-surface-sunken border border-line flex items-center justify-center text-accent">
                      <Package size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-content">Cabinet Inventory</h4>
                      <p className="text-[11px] text-content-subtle">
                        {lowStockCount > 0
                          ? `${lowStockCount} items low in cabinet`
                          : 'All scheduled medicines stocked'}
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/medicines/cabinet"
                    className="px-3 py-1.5 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line font-bold text-content text-xs flex items-center gap-1 transition-colors tap-spring"
                  >
                    Cabinet <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
              <div className="w-full sm:w-64">
                <SegmentedControl<ScheduleFilter>
                  value={activeFilter}
                  onChange={setActiveFilter}
                  size="sm"
                  fullWidth
                  options={[
                    { value: 'all', label: `All (${doses.length})` },
                    { value: 'actionable', label: `Due (${actionableCount})` },
                    { value: 'taken', label: `Done (${takenCount})` },
                  ]}
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-content-subtle">
                <span>{actionableCount === 0 ? '✓ Daily regimen complete' : `${actionableCount} administrations remaining`}</span>
              </div>
            </div>

            {/* Bento Grid Bottom Tier: 4 Daypart Bento Blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {BUCKET_ORDER.map((key) => {
                const slot = SLOT_META[key];
                const bucketDoses = buckets[key];
                const completed = bucketDoses.filter((d) => d.status === 'taken').length;
                const pending = bucketDoses.filter(
                  (d) => deriveStatusOnRead(d, new Date()) === 'pending' || deriveStatusOnRead(d, new Date()) === 'missed'
                ).length;
                const allDone = bucketDoses.length > 0 && completed === bucketDoses.length;

                return (
                  <div
                    key={key}
                    className={clsx(
                      'p-4 sm:p-5 rounded-3xl border bg-surface-raised transition-all duration-200 flex flex-col justify-between min-h-[320px] space-y-4',
                      allDone
                        ? 'border-teal-500/30 bg-teal-500/5'
                        : pending > 0
                          ? 'border-line shadow-2xs'
                          : 'border-line/60 opacity-80'
                    )}
                  >
                    <div>
                      {/* Daypart Bento Block Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-line/60">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={clsx(
                              'w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs',
                              slot.surface,
                              slot.text
                            )}
                          >
                            {slot.icon(14)}
                          </span>
                          <div>
                            <h3 className="text-xs font-black text-content uppercase tracking-tight">
                              {slot.label}
                            </h3>
                            <span className="text-[10px] text-content-subtle font-semibold">
                              {slot.timeRange}
                            </span>
                          </div>
                        </div>

                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded-lg text-[10px] font-black',
                            allDone
                              ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                              : 'bg-surface-sunken text-content-subtle border border-line'
                          )}
                        >
                          {completed}/{bucketDoses.length}
                        </span>
                      </div>

                      {/* Batch Take Button if multiple pending */}
                      {pending > 1 && !isPast && (
                        <button
                          type="button"
                          onClick={() => handleMarkRoutineTaken(bucketDoses, slot.label)}
                          className="w-full mt-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-500/20 transition-all cursor-pointer tap-spring"
                        >
                          Take all {pending} due ✓
                        </button>
                      )}

                      {/* Daypart Medicine List */}
                      <div className="space-y-2.5 mt-3">
                        {bucketDoses.length === 0 ? (
                          <div className="h-28 flex items-center justify-center text-xs text-content-subtle italic">
                            No doses in {slot.label.toLowerCase()}
                          </div>
                        ) : (
                          bucketDoses.map((dose) => {
                            const medicine = medicinesMap[dose.medicine_id];
                            const isTaken = dose.status === 'taken';
                            const isSkipped = dose.status === 'skipped';
                            const isMissed = deriveStatusOnRead(dose, new Date()) === 'missed';
                            const stock = inventory[dose.medicine_id];

                            return (
                              <div
                                key={dose.id}
                                className={clsx(
                                  'p-3.5 rounded-2xl border transition-all space-y-2.5',
                                  isTaken
                                    ? 'bg-surface-sunken/40 border-line/40 opacity-75'
                                    : isMissed
                                      ? 'bg-amber-500/5 border-amber-400/80 shadow-2xs'
                                      : 'bg-surface-sunken/70 border-line hover:border-line-strong shadow-2xs'
                                )}
                              >
                                {/* Top info row */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-content bg-surface px-2 py-0.5 rounded-lg border border-line">
                                    <Clock size={10} /> {formatDoseTime(dose.scheduled_minutes)}
                                  </span>

                                  {stock !== undefined && stock <= 5 && (
                                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                                      <AlertCircle size={10} /> {stock === 0 ? 'Out' : `${stock} left`}
                                    </span>
                                  )}
                                </div>

                                {/* Medicine name & strength */}
                                <div>
                                  <h4
                                    className={clsx(
                                      'text-xs sm:text-sm font-bold text-content tracking-tight leading-tight',
                                      isTaken && 'line-through text-content-muted'
                                    )}
                                  >
                                    {medicine?.medicine_name || 'Prescribed medicine'}
                                  </h4>
                                  <p className="text-[11px] text-content-muted font-medium mt-0.5">
                                    {medicine?.strength ? `${medicine.strength} · ` : ''}
                                    {medicine?.dose_amount || (medicine?.form ? `1 ${medicine.form}` : '1 dose')}
                                  </p>
                                </div>

                                {/* Bottom action bar */}
                                <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                                  <div className="text-[10px] font-bold text-content-subtle">
                                    {medicine?.with_food === true ? (
                                      <span className="text-amber-800 dark:text-amber-300 flex items-center gap-0.5">
                                        <Utensils size={10} /> Food
                                      </span>
                                    ) : medicine?.with_food === false ? (
                                      <span className="text-blue-800 dark:text-blue-300 flex items-center gap-0.5">
                                        <Droplets size={10} /> Empty
                                      </span>
                                    ) : (
                                      'Direct'
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {!isTaken && !isSkipped ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSkip(dose)}
                                          className="p-1 rounded-lg text-[10px] text-content-subtle hover:text-content"
                                          title="Skip dose"
                                        >
                                          Skip
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMarkTaken(dose)}
                                          className={clsx(
                                            'px-3 py-1 rounded-xl text-xs font-bold text-white shadow-2xs tap-spring cursor-pointer flex items-center gap-1',
                                            isMissed
                                              ? 'bg-amber-600 hover:bg-amber-700'
                                              : 'bg-teal-600 hover:bg-teal-700'
                                          )}
                                        >
                                          <Check size={12} className="stroke-[3]" />
                                          {isMissed ? 'Overdue' : 'Take'}
                                        </button>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400">
                                          {isTaken ? '✓ Taken' : 'Skipped'}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleUndo(dose)}
                                          className="p-1 rounded-lg text-content-subtle hover:text-content"
                                          title="Undo dose"
                                        >
                                          <RotateCcw size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Bento Block Footer Action */}
                    <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-content-subtle">
                      <span>{slot.label} Regimen</span>
                      <button
                        type="button"
                        onClick={() => {
                          const firstMed = bucketDoses[0] ? medicinesMap[bucketDoses[0].medicine_id] : null;
                          if (firstMed) handleOpenOrderModal(firstMed);
                        }}
                        className="text-accent hover:underline font-bold flex items-center gap-0.5"
                      >
                        <ShoppingBag size={11} /> Refill
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Medication Order & WhatsApp Procurement Modal */}
      <MedicineOrderModal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        medicine={selectedMedicineForOrder}
        profileId={effectiveProfileId}
        onStockUpdated={handleStockUpdated}
      />

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
