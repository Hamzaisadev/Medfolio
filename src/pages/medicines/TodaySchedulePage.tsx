import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Dialog } from '../../components/ui/Dialog';
import { Toast } from '../../components/ui/Toast';
import { Skeleton } from '../../components/ui/Skeleton';
import { DoseCard } from '../../components/ui/DoseCard';
import { MedicineOrderModal } from '../../components/medicines/MedicineOrderModal';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SLOT_META } from '../../components/ui/slotMeta';
import {
  PlusIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '../../components/ui/icons';
import {
  Archive,
  Check,
  ShieldCheck,
} from 'lucide-react';
import {
  todayInAppTz,
  fromAppDate,
  addDaysAppTz,
  formatRelativeDay,
  formatDateShort,
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
      message: `Cabinet updated: ${newStock} tablets of ${selectedMedicineForOrder.medicine_name} now in stock.`,
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

      {/* Compact & Focused Master Header Deck */}
      <div
        className="p-3 sm:p-4 px-4 sm:px-6 rounded-3xl bg-[#023b36] border border-[#0a544e]/70 shadow-[0_12px_32px_-8px_rgba(1,53,49,0.6)] mb-6 overflow-visible relative z-30"
      >
        <div className="flex items-center justify-between gap-4 lg:gap-6 w-full overflow-visible py-0.5 flex-wrap sm:flex-nowrap">
          {/* Left: App Icon + Title + Subtitle */}
          <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#00b59f] text-white flex items-center justify-center shrink-0 shadow-md">
              <CalendarIcon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight whitespace-nowrap">
                Medication Schedule
              </h1>
              <p className="text-xs text-[#a0d7d2] font-normal hidden sm:block whitespace-nowrap mt-0.5">
                Stay on track with your meds.
              </p>
            </div>
          </div>

          {/* Right Group: Date Steppers & Cabinet + Divider + KPI Stats (Total, Remaining, Pending) + Progress Gauge */}
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 shrink-0 ml-auto">
            {/* Date Stepper & Calendar Trigger */}
            <div className="flex items-center gap-1.5 shrink-0" ref={calendarRef}>
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => setSelectedDate(addDaysAppTz(selectedDate, -1))}
                className="w-8 h-8 rounded-full bg-[#012f2c] hover:bg-[#012522] border border-[#09524c] text-[#78c2ba] hover:text-white flex items-center justify-center tap-spring transition-all shadow-inner shrink-0"
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
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#012f2c] hover:bg-[#012522] border border-[#09524c] text-white text-xs font-semibold shadow-inner tap-spring whitespace-nowrap transition-all"
                  aria-expanded={isCalendarOpen}
                  aria-label="Select date"
                >
                  <CalendarIcon size={14} className="text-[#00e5c9]" />
                  <span>{displayDateLabel}</span>
                  <ChevronDownIcon
                    size={12}
                    className={clsx('text-[#78c2ba] transition-transform duration-200', isCalendarOpen && 'rotate-180')}
                  />
                </button>

                {/* Interactive Calendar Popover */}
                {isCalendarOpen && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 p-3.5 rounded-2xl bg-surface-raised border border-line-strong shadow-raise z-50 text-content animate-in fade-in zoom-in-95 duration-150"
                    role="dialog"
                    aria-label="Select date from calendar"
                  >
                    {/* Calendar Month Header */}
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

                    {/* Weekday Labels */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-1">
                      {WEEKDAYS.map((wd) => (
                        <span key={wd} className="text-[10px] font-bold text-content-subtle uppercase">
                          {wd}
                        </span>
                      ))}
                    </div>

                    {/* Day Cells Grid */}
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

                    {/* Quick Jump Shortcuts */}
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
                className="w-8 h-8 rounded-full bg-[#012f2c] hover:bg-[#012522] border border-[#09524c] text-[#78c2ba] hover:text-white flex items-center justify-center tap-spring transition-all shadow-inner shrink-0"
              >
                <ChevronRightIcon size={13} />
              </button>
            </div>

            {/* Cabinet Icon-Only Button */}
            <Link
              to="/medicines/cabinet"
              aria-label="Medicine Cabinet"
              title="Medicine Cabinet"
              className="w-8 h-8 rounded-full bg-[#012f2c] hover:bg-[#012522] border border-[#09524c] text-[#78c2ba] hover:text-white flex items-center justify-center tap-spring transition-all shadow-inner shrink-0"
            >
              <Archive size={14} />
            </Link>

            {/* Vertical Divider between Date Controls & KPI Stats */}
            <div className="h-7 w-[1px] bg-teal-500/25 mx-1 hidden md:block" />

            {/* 3 KPI Metrics (Total, Remaining, Pending) */}
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 shrink-0">
              <div className="flex flex-col items-center min-w-[34px] sm:min-w-[40px]">
                <div className="h-7 sm:h-7.5 flex items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white leading-none" data-numeric>
                    {doses.length}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-[#78c2ba] block mt-1 leading-tight text-center">
                  Total
                </span>
              </div>

              <div className="h-6 w-[1px] bg-teal-500/25" />

              <div className="flex flex-col items-center min-w-[34px] sm:min-w-[40px]">
                <div className="h-7 sm:h-7.5 flex items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white leading-none" data-numeric>
                    {doses.length - takenCount}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-[#78c2ba] block mt-1 leading-tight text-center">
                  Remaining
                </span>
              </div>

              <div className="h-6 w-[1px] bg-teal-500/25" />

              <div className="flex flex-col items-center min-w-[34px] sm:min-w-[40px]">
                <div className="h-7 sm:h-7.5 flex items-center justify-center">
                  <span className="text-sm sm:text-base font-bold text-white leading-none" data-numeric>
                    {pendingCount}
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-[#78c2ba] block mt-1 leading-tight text-center">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Routine Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-content-subtle">
            <ShieldCheck size={13} className="text-teal-600" />
            <span>Chronotherapy Active</span>
          </div>

          <Link to="/prescriptions/new">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<PlusIcon size={13} />}
              className="h-8 px-3 text-xs font-bold rounded-xl tap-spring shadow-2xs"
            >
              Scan Prescription
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Chronotherapy Medication Stream (Full-Width with 3-Column Dose Tiles) */}
      <main className="space-y-7">
        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
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
          /* Chronotherapy Timed Sections (3 Columns) */
          <div className="space-y-7">
            {BUCKET_ORDER.map((key) => {
              const bucketDoses = buckets[key];
              if (bucketDoses.length === 0) return null;
              const slot = SLOT_META[key];
              const bucketPending = bucketDoses.filter(
                (d) => deriveStatusOnRead(d, new Date()) === 'pending' || deriveStatusOnRead(d, new Date()) === 'missed'
              ).length;

              return (
                <section key={key} aria-labelledby={`slot-${key}`} className="space-y-3.5">
                  {/* Routine Header Bar with Executive Styling */}
                  <div className="flex items-center justify-between gap-3 px-1 py-1.5 border-b border-line/60 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={clsx(
                          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs',
                          slot.surface,
                          slot.text,
                          slot.border
                        )}
                      >
                        {slot.icon(16)}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 id={`slot-${key}`} className="text-sm font-bold text-content tracking-tight uppercase">
                          {slot.label} Routine
                        </h2>
                        <span className="text-[11px] text-content-subtle font-semibold px-2 py-0.5 rounded-md bg-surface-sunken border border-line">
                          {slot.timeRange}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {bucketPending > 1 && !isPast && (
                        <button
                          type="button"
                          onClick={() => handleMarkRoutineTaken(bucketDoses, slot.label)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-500/20 transition-all cursor-pointer tap-spring shadow-2xs"
                        >
                          <Check size={13} className="stroke-[2.5]" />
                          Take all due ({bucketPending})
                        </button>
                      )}

                      <span
                        className={clsx(
                          'px-2.5 py-1 rounded-xl border text-xs font-bold shadow-2xs',
                          bucketPending > 0
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                            : 'bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400'
                        )}
                      >
                        {bucketPending > 0 ? `${bucketPending} of ${bucketDoses.length} due` : 'All taken ✓'}
                      </span>
                    </div>
                  </div>

                  {/* 3-Column Medication Tiles Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bucketDoses.map((dose) => {
                      const medicine = medicinesMap[dose.medicine_id];
                      return (
                        <DoseCard
                          key={dose.id}
                          medicineName={medicine?.medicine_name || 'Prescribed medicine'}
                          strength={medicine?.strength}
                          doseAmount={medicine?.dose_amount || (medicine?.form ? `1 ${medicine.form}` : undefined)}
                          scheduledMinutes={dose.scheduled_minutes}
                          status={deriveStatusOnRead(dose, new Date())}
                          withFood={medicine?.with_food}
                          instructions={medicine?.instructions}
                          skippedReason={dose.skipped_reason}
                          remaining={inventory[dose.medicine_id]}
                          onTake={() => handleMarkTaken(dose)}
                          onSkip={() => handleOpenSkip(dose)}
                          onUndo={() => handleUndo(dose)}
                          onSelect={() => handleOpenOrderModal(medicine)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Medication Order, WhatsApp Refill & Procurement Modal */}
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
