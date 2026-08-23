import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface MedicalDatePickerProps {
  id?: string;
  value?: string; // YYYY-MM-DD format
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  className?: string;
  mode?: 'recent' | 'birthdate' | 'all';
  showAge?: boolean;
}

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

export function MedicalDatePicker({
  id,
  value,
  onChange,
  disabled = false,
  className,
  mode = 'recent',
  showAge = false,
}: MedicalDatePickerProps) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const currentYear = new Date().getFullYear();

  // Dynamic year generation based on mode
  const YEARS = (() => {
    if (mode === 'recent') {
      // 2 years back, 5 years ahead (for visits and follow-ups)
      const list: string[] = [];
      for (let y = currentYear + 5; y >= currentYear - 3; y--) {
        list.push(String(y));
      }
      return list;
    }
    // Birthdate or all (1920 to currentYear)
    return Array.from({ length: currentYear - 1920 + 1 }, (_, i) => String(currentYear - i));
  })();

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-');
      setYear(parts[0] || '');
      setMonth(parts[1] || '');
      setDay(parts[2] || '');
    } else if (!value) {
      setDay('');
      setMonth('');
      setYear('');
    }
  }, [value]);

  const handleUpdate = (newDay: string, newMonth: string, newYear: string) => {
    if (newYear && newMonth && newDay) {
      const paddedDay = newDay.padStart(2, '0');
      const iso = `${newYear}-${newMonth}-${paddedDay}`;
      onChange(iso);
    } else {
      onChange('');
    }
  };

  let ageDisplay: string | null = null;
  if (year && month && day && Number(year) > 1920) {
    const dob = new Date(Number(year), Number(month) - 1, Number(day));
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age >= 0 && age <= 120) {
      ageDisplay = `${age} years old`;
    }
  }

  const daysInMonth = month && year ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const DAYS = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));

  const selectStyle = clsx(
    'h-12 bg-surface-raised border border-line-strong rounded-[var(--radius-md)] px-3 text-xs sm:text-sm text-content',
    'focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent transition cursor-pointer appearance-none',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  return (
    <div className={twMerge('space-y-2', className)} id={id}>
      <div className="grid grid-cols-3 gap-2">
        {/* Month */}
        <div className="relative">
          <select
            value={month}
            onChange={(e) => {
              const m = e.target.value;
              setMonth(m);
              handleUpdate(day, m, year);
            }}
            disabled={disabled}
            className={twMerge(selectStyle, 'w-full pr-7')}
          >
            <option value="" className="bg-surface text-content-muted">Month</option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value} className="bg-surface text-content">
                {m.label}
              </option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-subtle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        {/* Day */}
        <div className="relative">
          <select
            value={day}
            onChange={(e) => {
              const d = e.target.value;
              setDay(d);
              handleUpdate(d, month, year);
            }}
            disabled={disabled}
            className={twMerge(selectStyle, 'w-full pr-7')}
          >
            <option value="" className="bg-surface text-content-muted">Day</option>
            {DAYS.map((d) => (
              <option key={d} value={d} className="bg-surface text-content">
                {d}
              </option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-subtle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        {/* Year */}
        <div className="relative">
          <select
            value={year}
            onChange={(e) => {
              const y = e.target.value;
              setYear(y);
              handleUpdate(day, month, y);
            }}
            disabled={disabled}
            className={twMerge(selectStyle, 'w-full pr-7')}
          >
            <option value="" className="bg-surface text-content-muted">Year</option>
            {YEARS.map((y) => (
              <option key={y} value={y} className="bg-surface text-content">
                {y}
              </option>
            ))}
          </select>
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-content-subtle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </div>

      {showAge && ageDisplay && (
        <div className="flex items-center gap-1.5 text-xs text-content-muted pl-0.5">
          <span>Calculated age:</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-hover border border-line text-content font-medium">
            {ageDisplay}
          </span>
        </div>
      )}
    </div>
  );
}
