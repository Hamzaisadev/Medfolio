import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  addDaysAppTz,
  formatDayHeading,
  formatDayNameShort,
  formatDayOfMonth,
  formatMonthYear,
  todayInAppTz,
  fromAppDate,
} from '../../lib/time';
import { IconButton } from './IconButton';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CalendarIcon,
} from './icons';
import { modalScaleSpring } from '../../lib/motion';

export interface DateStripProps {
  /** Currently selected 'YYYY-MM-DD'. */
  value: string;
  onChange: (dateStr: string) => void;
  /** How many days to show, centred on the selection. */
  windowDays?: number;
  now?: Date;
  className?: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * A scrollable strip of days with built-in Month-Year Calendar Picker and spring gliding selection.
 */
export function DateStrip({
  value,
  onChange,
  windowDays = 7,
  now = new Date(),
  className,
}: DateStripProps) {
  const today = todayInAppTz(now);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Month grid view state (Year & Month index 0-11)
  const [viewYear, setViewYear] = useState(() => {
    try {
      return fromAppDate(value).getUTCFullYear();
    } catch {
      return new Date().getFullYear();
    }
  });

  const [viewMonth, setViewMonth] = useState(() => {
    try {
      return fromAppDate(value).getUTCMonth();
    } catch {
      return new Date().getMonth();
    }
  });

  // Sync calendar view month when selected date changes externally
  useEffect(() => {
    try {
      const d = fromAppDate(value);
      setViewYear(d.getUTCFullYear());
      setViewMonth(d.getUTCMonth());
    } catch {
      // ignore
    }
  }, [value]);

  // Close calendar popover on outside click
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

  const days = useMemo(() => {
    const half = Math.floor(windowDays / 2);
    return Array.from({ length: windowDays }, (_, i) => addDaysAppTz(value, i - half));
  }, [value, windowDays]);

  // Keep the selection in view when it moves via the arrows or a jump to today.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [value]);

  // Calendar Grid Days Calculation
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

  return (
    <div
      className={clsx(
        'p-3 rounded-2xl border border-line bg-surface-raised shadow-card space-y-2.5 relative',
        className
      )}
    >
      {/* Top Header: Month & Year Navigator + Calendar Trigger + Jump to Today */}
      <div className="flex items-center justify-between px-1">
        <div className="relative" ref={calendarRef}>
          <button
            type="button"
            onClick={() => setIsCalendarOpen((prev) => !prev)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-sunken hover:bg-surface-hover border border-line transition-all text-content font-bold text-sm cursor-pointer"
            aria-expanded={isCalendarOpen}
            aria-label="Open month calendar"
          >
            <CalendarIcon size={15} className="text-accent" />
            <span>{formatMonthYear(value)}</span>
            <ChevronDownIcon
              size={14}
              className={clsx('text-content-muted transition-transform duration-200', isCalendarOpen && 'rotate-180')}
            />
          </button>

          {/* Interactive Month Calendar Popup */}
          <AnimatePresence>
            {isCalendarOpen && (
              <motion.div
                className="absolute left-0 top-full mt-2 w-72 p-3.5 rounded-2xl bg-surface-raised border border-line-strong shadow-raise z-50"
                role="dialog"
                aria-label="Select date from calendar"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={modalScaleSpring}
              >
                {/* Calendar Month Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                  <IconButton
                    aria-label="Previous month"
                    onClick={handlePrevMonth}
                    size="sm"
                  >
                    <ChevronLeftIcon size={15} />
                  </IconButton>

                  <div className="text-xs font-bold text-content">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </div>

                  <IconButton
                    aria-label="Next month"
                    onClick={handleNextMonth}
                    size="sm"
                  >
                    <ChevronRightIcon size={15} />
                  </IconButton>
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
                    const isSelected = cell.dateStr === value;
                    const isTodayCell = cell.dateStr === today;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => {
                          onChange(cell.dateStr);
                          setIsCalendarOpen(false);
                        }}
                        className={clsx(
                          'h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all relative cursor-pointer',
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
                      onChange(addDaysAppTz(value, -7));
                      setIsCalendarOpen(false);
                    }}
                    className="px-2 py-1 rounded-md text-content-muted hover:bg-surface-hover hover:text-content font-medium transition-colors cursor-pointer"
                  >
                    ← Previous Week
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(today);
                      setIsCalendarOpen(false);
                    }}
                    className="px-2 py-1 rounded-md bg-accent-subtle text-accent font-bold hover:bg-accent hover:text-content-onaccent transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(addDaysAppTz(value, 7));
                      setIsCalendarOpen(false);
                    }}
                    className="px-2 py-1 rounded-md text-content-muted hover:bg-surface-hover hover:text-content font-medium transition-colors cursor-pointer"
                  >
                    Next Week →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Today Jump Button in Header */}
        {value !== today && (
          <button
            type="button"
            onClick={() => onChange(today)}
            className="px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent-subtle rounded-lg border border-accent/20 transition-all focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
          >
            Jump to Today
          </button>
        )}
      </div>

      {/* Horizontal Day Strip with Layout Animation */}
      <div className="flex items-center gap-1.5">
        <IconButton
          aria-label="Previous day"
          onClick={() => onChange(addDaysAppTz(value, -1))}
          size="sm"
        >
          <ChevronLeftIcon size={18} />
        </IconButton>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label="Select a day">
          {days.map((day) => {
            const isSelected = day === value;
            const isTodayCell = day === today;
            const isFuture = day > today;

            return (
              <button
                key={day}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                onClick={() => onChange(day)}
                aria-current={isSelected ? 'date' : undefined}
                aria-label={formatDayHeading(day, now)}
                className={clsx(
                  'relative shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-xl cursor-pointer',
                  'transition-[color] duration-[var(--duration-fast)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  isSelected
                    ? 'text-content-onaccent font-bold'
                    : [
                        'hover:bg-surface-hover',
                        isFuture ? 'text-content-subtle' : 'text-content-muted',
                      ]
                )}
              >
                {isSelected && (
                  <motion.div
                    layoutId="active-date-strip-pill"
                    className="absolute inset-0 rounded-xl bg-accent shadow-xs"
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  />
                )}

                <span className="relative z-10 text-2xs uppercase tracking-wide">{formatDayNameShort(day)}</span>
                <span className="relative z-10 text-base font-semibold leading-tight" data-numeric>
                  {formatDayOfMonth(day)}
                </span>
                {isTodayCell && (
                  <span
                    className={clsx(
                      'relative z-10 mt-0.5 w-1 h-1 rounded-full',
                      isSelected ? 'bg-content-onaccent' : 'bg-accent'
                    )}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <IconButton aria-label="Next day" onClick={() => onChange(addDaysAppTz(value, 1))} size="sm">
          <ChevronRightIcon size={18} />
        </IconButton>
      </div>
    </div>
  );
}
