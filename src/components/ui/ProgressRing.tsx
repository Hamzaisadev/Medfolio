import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressRingProps {
  percentage: number; // 0 to 100
  size?: number; // pixel diameter
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 7,
  label = 'adherence',
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={twMerge(clsx('inline-flex flex-col items-center justify-center', className))}
    >
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg]"
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-ink-200)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-brand-600)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Text inside — ensures accessibility without arc-alone perception */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold text-ink-900 leading-none">
            {clamped}%
          </span>
        </div>
      </div>
      {label && <span className="mt-1 text-xs text-ink-500 font-medium">{label}</span>}
    </div>
  );
}
