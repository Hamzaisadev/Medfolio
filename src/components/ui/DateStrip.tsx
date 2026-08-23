import { useEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import {
  addDaysAppTz,
  formatDayHeading,
  formatDayNameShort,
  formatDayOfMonth,
  todayInAppTz,
} from '../../lib/time';
import { IconButton } from './IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export interface DateStripProps {
  /** Currently selected 'YYYY-MM-DD'. */
  value: string;
  onChange: (dateStr: string) => void;
  /** How many days to show, centred on the selection. */
  windowDays?: number;
  now?: Date;
  className?: string;
}

/**
 * A scrollable strip of days.
 *
 * Replaces the "← Previous Day / 2026-08-16 / Next Day →" control, which showed a
 * raw ISO date, gave no sense of where in the week you were, and offered no way
 * back to today once you had paged away.
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

  const days = useMemo(() => {
    const half = Math.floor(windowDays / 2);
    return Array.from({ length: windowDays }, (_, i) => addDaysAppTz(value, i - half));
  }, [value, windowDays]);

  // Keep the selection in view when it moves via the arrows or a jump to today.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [value]);

  return (
    <div
      className={clsx(
        'flex items-center gap-2 p-2 rounded-[var(--radius-xl)]',
        'border border-line bg-surface-raised shadow-card',
        className
      )}
    >
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
                'shrink-0 flex flex-col items-center justify-center w-12 h-14 rounded-[var(--radius-md)]',
                'transition-[background-color,color] duration-[var(--duration-fast)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isSelected
                  ? 'bg-accent text-content-onaccent font-bold'
                  : [
                      'hover:bg-surface-hover',
                      // Days with no data yet are dimmed so the strip reads as
                      // "history behind, schedule ahead".
                      isFuture ? 'text-content-subtle' : 'text-content-muted',
                    ]
              )}
            >
              <span className="text-2xs uppercase tracking-wide">{formatDayNameShort(day)}</span>
              <span className="text-base font-semibold leading-tight" data-numeric>
                {formatDayOfMonth(day)}
              </span>
              {isTodayCell && (
                <span
                  className={clsx(
                    'mt-0.5 w-1 h-1 rounded-full',
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

      {value !== today && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="shrink-0 px-3 h-11 text-xs font-bold text-accent hover:bg-accent-subtle rounded-[var(--radius-md)] transition-colors focus-visible:outline-2 focus-visible:outline-accent"
        >
          Today
        </button>
      )}
    </div>
  );
}
