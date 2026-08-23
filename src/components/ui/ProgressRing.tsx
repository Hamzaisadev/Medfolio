import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ProgressRingProps {
  percentage: number; // 0 to 100
  size?: number; // pixel diameter
  strokeWidth?: number;
  label?: string;
  /** Colours the arc by meaning rather than always using the brand accent. */
  tone?: 'accent' | 'ok' | 'warn' | 'risk';
  /** Hides the inner percentage text, e.g. when the value is shown alongside. */
  hideValue?: boolean;
  className?: string;
}

const arcColor: Record<NonNullable<ProgressRingProps['tone']>, string> = {
  accent: 'var(--accent)',
  ok: 'var(--ok-text)',
  warn: 'var(--warn-text)',
  risk: 'var(--risk-text)',
};

export function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 7,
  label,
  tone = 'accent',
  hideValue = false,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className={twMerge(clsx('inline-flex flex-col items-center justify-center', className))}>
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg]"
          role="img"
          aria-label={`${clamped}%${label ? ` ${label}` : ''}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--line)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arcColor[tone]}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            className="transition-[stroke-dashoffset] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)]"
          />
        </svg>

        {/* The number is rendered, not implied by the arc: an arc alone is not a
            value anyone can read precisely. */}
        {!hideValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-content leading-none" data-numeric>
              {clamped}%
            </span>
          </div>
        )}
      </div>
      {label && <span className="mt-1.5 text-xs text-content-subtle font-medium">{label}</span>}
    </div>
  );
}
