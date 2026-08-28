import { useState, useEffect, useMemo, useRef } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  XIcon,
} from './icons';

export interface MedicalDatePickerProps {
  id?: string;
  value?: string; // YYYY-MM-DD format or common date strings
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  mode?: 'recent' | 'birthdate' | 'all';
  showAge?: boolean;
}

const MONTHS = [
  { value: '01', label: 'Jan', full: 'January' },
  { value: '02', label: 'Feb', full: 'February' },
  { value: '03', label: 'Mar', full: 'March' },
  { value: '04', label: 'Apr', full: 'April' },
  { value: '05', label: 'May', full: 'May' },
  { value: '06', label: 'Jun', full: 'June' },
  { value: '07', label: 'Jul', full: 'July' },
  { value: '08', label: 'Aug', full: 'August' },
  { value: '09', label: 'Sep', full: 'September' },
  { value: '10', label: 'Oct', full: 'October' },
  { value: '11', label: 'Nov', full: 'November' },
  { value: '12', label: 'Dec', full: 'December' },
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Robust date parser for standard ISO, slash-separated, and timestamped dates.
 */
function parseDateString(str?: string | null): { year: number; month: number; day: number; iso: string } | null {
  if (!str) return null;
  const trimmed = String(str).trim();
  if (!trimmed) return null;

  // Case 1: YYYY-MM-DD or YYYY/MM/DD (with optional timestamp)
  let match = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: y, month: m, day: d, iso };
    }
  }

  // Case 2: DD/MM/YYYY or DD-MM-YYYY
  match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    const d = Number(match[1]);
    const m = Number(match[2]);
    const y = Number(match[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: y, month: m, day: d, iso };
    }
  }

  // Case 3: General JS Date fallback
  const dObj = new Date(trimmed);
  if (!isNaN(dObj.getTime())) {
    const y = dObj.getFullYear();
    const m = dObj.getMonth() + 1;
    const d = dObj.getDate();
    if (y >= 1900 && y <= 2100) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: y, month: m, day: d, iso };
    }
  }

  return null;
}

export function MedicalDatePicker({
  id,
  value,
  onChange,
  disabled = false,
  className,
  mode = 'recent',
  showAge = false,
}: MedicalDatePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<'days' | 'months' | 'years'>('days');

  const yearListRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayNum}`;
  }, []);

  const parsedDate = useMemo(() => parseDateString(value), [value]);

  // Dynamic year options for grid
  const YEARS = useMemo(() => {
    if (mode === 'recent') {
      const list: string[] = [];
      for (let y = currentYear + 5; y >= currentYear - 10; y--) {
        list.push(String(y));
      }
      return list;
    }
    return Array.from({ length: currentYear - 1900 + 1 }, (_, i) => String(currentYear - i));
  }, [mode, currentYear]);

  // Calendar navigation state
  const [viewYear, setViewYear] = useState<number>(() => {
    if (parsedDate) return parsedDate.year;
    return mode === 'birthdate' ? 2000 : currentYear;
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (parsedDate) return parsedDate.month - 1;
    return currentMonth;
  });

  // Sync internal view year/month when value changes externally
  useEffect(() => {
    if (parsedDate) {
      setViewYear(parsedDate.year);
      setViewMonth(parsedDate.month - 1);
    }
  }, [parsedDate]);

  // Scroll to active year when opening year picker view
  useEffect(() => {
    if (isCalendarOpen && calendarView === 'years' && yearListRef.current) {
      const selectedYearBtn = yearListRef.current.querySelector('[data-selected="true"]');
      if (selectedYearBtn) {
        selectedYearBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [isCalendarOpen, calendarView]);

  const handleSelectDateFromCalendar = (dateIso: string) => {
    onChange(dateIso);
    setIsCalendarOpen(false);
    setCalendarView('days');
  };

  const handleSelectMonth = (mIndex: number) => {
    const selectedYear = parsedDate ? parsedDate.year : viewYear;
    const selectedDay = parsedDate ? Math.min(parsedDate.day, new Date(selectedYear, mIndex + 1, 0).getDate()) : 1;
    const mm = String(mIndex + 1).padStart(2, '0');
    const dd = String(selectedDay).padStart(2, '0');
    onChange(`${selectedYear}-${mm}-${dd}`);
    setViewMonth(mIndex);
    setCalendarView('days');
  };

  const handleSelectYear = (y: number) => {
    const selectedMonth = parsedDate ? parsedDate.month - 1 : viewMonth;
    const selectedDay = parsedDate ? Math.min(parsedDate.day, new Date(y, selectedMonth + 1, 0).getDate()) : 1;
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const dd = String(selectedDay).padStart(2, '0');
    onChange(`${y}-${mm}-${dd}`);
    setViewYear(y);
    setCalendarView('days');
  };

  // Age calculation
  const ageDisplay = useMemo(() => {
    if (!parsedDate) return null;
    const { year: y, month: m, day: d } = parsedDate;
    if (y < 1900) return null;
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age >= 0 && age <= 130) {
      return `${age} years old`;
    }
    return null;
  }, [parsedDate]);

  // Calendar Day Cells Calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startDayIndex = (firstDayOfMonth.getUTCDay() + 6) % 7; // Mon = 0, Sun = 6
    const totalDaysInCurrentMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isFuture: boolean;
    }> = [];

    // Prev month padding
    const prevMonthTotalDays = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const mm = String(prevM + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${prevY}-${mm}-${dd}`;
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isFuture: dateStr > todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInCurrentMonth; d++) {
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${viewYear}-${mm}-${dd}`;
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isFuture: dateStr > todayStr,
      });
    }

    // Next month padding
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const mm = String(nextM + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${nextY}-${mm}-${dd}`;
      cells.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isFuture: dateStr > todayStr,
      });
    }

    return cells;
  }, [viewYear, viewMonth, todayStr]);

  const selectedMonthObj = parsedDate
    ? MONTHS.find((item) => Number(item.value) === parsedDate.month)
    : null;

  return (
    <div className={twMerge('space-y-1.5 relative w-full', className)}>
      <Popover.Root open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        {/* Connected 3-Segment Input Box: Month | Day | Year | Calendar */}
        <div
          id={id}
          className={twMerge(
            'h-12 w-full bg-surface-raised border border-line-strong rounded-[var(--radius-md)] flex items-stretch divide-x divide-line transition-all overflow-hidden shadow-2xs',
            isCalendarOpen && 'border-accent ring-2 ring-accent/20',
            disabled && 'opacity-50 pointer-events-none'
          )}
        >
          {/* Month Segment */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCalendarView('months');
              setIsCalendarOpen(true);
            }}
            aria-label="Select month"
            className="flex-[1.1] min-w-0 px-2 flex items-center justify-center gap-1 hover:bg-surface-hover transition cursor-pointer select-none"
          >
            <span className={clsx('text-xs sm:text-sm font-semibold truncate', selectedMonthObj ? 'text-content' : 'text-content-muted')}>
              {selectedMonthObj ? selectedMonthObj.label : 'Month'}
            </span>
            <ChevronDownIcon size={11} className="text-content-subtle shrink-0" />
          </button>

          {/* Day Segment */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCalendarView('days');
              setIsCalendarOpen(true);
            }}
            aria-label="Select day"
            className="flex-[0.9] min-w-0 px-2 flex items-center justify-center gap-1 hover:bg-surface-hover transition cursor-pointer select-none"
          >
            <span className={clsx('text-xs sm:text-sm font-semibold truncate', parsedDate ? 'text-content' : 'text-content-muted')}>
              {parsedDate ? parsedDate.day : 'Day'}
            </span>
            <ChevronDownIcon size={11} className="text-content-subtle shrink-0" />
          </button>

          {/* Year Segment (Full 4-digit width) */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setCalendarView('years');
              setIsCalendarOpen(true);
            }}
            aria-label="Select year"
            className="flex-[1.3] min-w-0 px-2 flex items-center justify-center gap-1 hover:bg-surface-hover transition cursor-pointer select-none"
          >
            <span className={clsx('text-xs sm:text-sm font-semibold truncate', parsedDate ? 'text-content' : 'text-content-muted')}>
              {parsedDate ? parsedDate.year : 'Year'}
            </span>
            <ChevronDownIcon size={11} className="text-content-subtle shrink-0" />
          </button>

          {/* Calendar Action Button */}
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setCalendarView('days');
                setIsCalendarOpen(true);
              }}
              aria-label="Open full calendar picker"
              className={clsx(
                'w-11 px-2.5 flex items-center justify-center transition cursor-pointer shrink-0',
                isCalendarOpen
                  ? 'bg-accent text-accent-onaccent'
                  : 'text-accent hover:bg-surface-hover hover:text-accent'
              )}
            >
              <CalendarIcon size={16} />
            </button>
          </Popover.Trigger>
        </div>

        {/* Floating Themed Popover with 80px Top Header Clearance */}
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={6}
            collisionPadding={{ top: 80, bottom: 24, left: 16, right: 16 }}
            avoidCollisions
            className="w-76 max-w-[calc(100vw-2rem)] p-3 rounded-2xl bg-surface-raised border border-line-strong shadow-over z-[100] animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
          >
            {/* Header with Custom Month & Year Buttons + Navigation */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
              <div className="flex items-center gap-1">
                {/* Switch to Month Grid */}
                <button
                  type="button"
                  onClick={() => setCalendarView((v) => (v === 'months' ? 'days' : 'months'))}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    calendarView === 'months'
                      ? 'bg-accent text-accent-onaccent'
                      : 'bg-surface-hover text-content hover:bg-surface-sunken'
                  )}
                  aria-label="Choose month"
                >
                  <span>{MONTHS[viewMonth]?.full || 'Month'}</span>
                  <ChevronDownIcon size={11} className={clsx(calendarView === 'months' && 'rotate-180')} />
                </button>

                {/* Switch to Custom Year Grid */}
                <button
                  type="button"
                  onClick={() => setCalendarView((v) => (v === 'years' ? 'days' : 'years'))}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    calendarView === 'years'
                      ? 'bg-accent text-accent-onaccent'
                      : 'bg-surface-hover text-content hover:bg-surface-sunken'
                  )}
                  aria-label="Choose year"
                >
                  <span>{viewYear}</span>
                  <ChevronDownIcon size={11} className={clsx(calendarView === 'years' && 'rotate-180')} />
                </button>
              </div>

              {/* Step Navigation Buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (calendarView === 'years') {
                      setViewYear((y) => Math.max(1900, y - 12));
                    } else if (calendarView === 'months') {
                      setViewYear((y) => Math.max(1900, y - 1));
                    } else {
                      if (viewMonth === 0) {
                        setViewMonth(11);
                        setViewYear((y) => y - 1);
                      } else {
                        setViewMonth((m) => m - 1);
                      }
                    }
                  }}
                  className="h-6.5 w-6.5 rounded-md flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-hover transition cursor-pointer"
                  aria-label="Previous page"
                >
                  <ChevronLeftIcon size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (calendarView === 'years') {
                      setViewYear((y) => Math.min(currentYear + (mode === 'recent' ? 5 : 0), y + 12));
                    } else if (calendarView === 'months') {
                      setViewYear((y) => Math.min(currentYear + (mode === 'recent' ? 5 : 0), y + 1));
                    } else {
                      if (viewMonth === 11) {
                        setViewMonth(0);
                        setViewYear((y) => y + 1);
                      } else {
                        setViewMonth((m) => m + 1);
                      }
                    }
                  }}
                  className="h-6.5 w-6.5 rounded-md flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-hover transition cursor-pointer"
                  aria-label="Next page"
                >
                  <ChevronRightIcon size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(false)}
                  className="h-6.5 w-6.5 rounded-md flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-hover transition ml-0.5 cursor-pointer"
                  aria-label="Close calendar"
                >
                  <XIcon size={13} />
                </button>
              </div>
            </div>

            {/* VIEW 1: Custom Themed Year Picker Grid */}
            {calendarView === 'years' && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-content-subtle uppercase px-1">
                  Select Year (1900 – {mode === 'recent' ? currentYear + 5 : currentYear})
                </div>
                <div
                  ref={yearListRef}
                  className="grid grid-cols-4 gap-1 max-h-44 overflow-y-auto pr-1 custom-scrollbar py-0.5"
                >
                  {YEARS.map((y) => {
                    const isSelectedYear = String(viewYear) === y;
                    return (
                      <button
                        key={y}
                        type="button"
                        data-selected={isSelectedYear}
                        onClick={() => handleSelectYear(Number(y))}
                        className={clsx(
                          'h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
                          isSelectedYear
                            ? 'bg-accent text-accent-onaccent font-bold shadow-xs'
                            : 'bg-surface-hover text-content hover:bg-surface-sunken hover:text-accent'
                        )}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 2: Custom Themed Month Picker Grid */}
            {calendarView === 'months' && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-content-subtle uppercase px-1">
                  Select Month ({viewYear})
                </div>
                <div className="grid grid-cols-3 gap-1.5 py-0.5">
                  {MONTHS.map((m, idx) => {
                    const isSelectedMonth = viewMonth === idx;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => handleSelectMonth(idx)}
                        className={clsx(
                          'h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
                          isSelectedMonth
                            ? 'bg-accent text-accent-onaccent font-bold shadow-xs'
                            : 'bg-surface-hover text-content hover:bg-surface-sunken hover:text-accent'
                        )}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 3: Standard Themed Days Grid */}
            {calendarView === 'days' && (
              <div>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                  {WEEKDAYS.map((wd) => (
                    <span key={wd} className="text-[10px] font-bold text-content-subtle uppercase">
                      {wd}
                    </span>
                  ))}
                </div>

                {/* Day numbers */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarDays.map((cell) => {
                    const isSelectedDay = cell.dateStr === parsedDate?.iso;
                    const isTodayCell = cell.dateStr === todayStr;
                    const isFutureDisabled = mode === 'birthdate' && cell.isFuture;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={isFutureDisabled}
                        onClick={() => handleSelectDateFromCalendar(cell.dateStr)}
                        className={clsx(
                          'h-7 w-7 text-xs font-semibold rounded-lg flex items-center justify-center transition-all relative mx-auto cursor-pointer',
                          isSelectedDay
                            ? 'bg-accent text-accent-onaccent font-bold shadow-xs'
                            : isFutureDisabled
                              ? 'text-content-subtle opacity-20 cursor-not-allowed'
                              : cell.isCurrentMonth
                            ? 'text-content hover:bg-surface-hover'
                            : 'text-content-subtle opacity-40 hover:opacity-100 hover:bg-surface-hover',
                          isTodayCell && !isSelectedDay && 'ring-1 ring-accent font-bold text-accent'
                        )}
                      >
                        {cell.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calendar Bottom Bar: Today Shortcut / Clear */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-line text-xs">
              {mode !== 'birthdate' ? (
                <button
                  type="button"
                  onClick={() => handleSelectDateFromCalendar(todayStr)}
                  className="text-accent font-bold hover:underline cursor-pointer"
                >
                  Today
                </button>
              ) : (
                <span className="text-[11px] text-content-subtle">
                  {ageDisplay || 'Select date of birth'}
                </span>
              )}

              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                  }}
                  className="text-content-muted hover:text-content font-medium transition text-xs cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Calculated Age Preview (if showAge enabled) */}
      {showAge && ageDisplay && (
        <div className="flex items-center gap-1.5 text-xs text-content-muted pl-0.5 animate-in fade-in duration-200">
          <span>Calculated age:</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-hover border border-line text-content font-semibold">
            {ageDisplay}
          </span>
        </div>
      )}
    </div>
  );
}
