import { useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { RollingNumber } from './RollingNumber';

export interface VitalsGaugeProps {
  value: number;
  min: number;
  max: number;
  targetMin?: number;
  targetMax?: number;
  label: string;
  unit: string;
  tone?: 'ok' | 'warn' | 'risk' | 'info';
  statusText?: string;
  className?: string;
}

const TONE_COLORS: Record<NonNullable<VitalsGaugeProps['tone']>, string> = {
  ok: 'var(--ok-text)',
  warn: 'var(--warn-text)',
  risk: 'var(--risk-text)',
  info: 'var(--accent)',
};

/**
 * Interactive radial vitals gauge with animated needle/arc sweep and clinical target bands.
 */
export function VitalsGauge({
  value,
  min,
  max,
  targetMin,
  targetMax,
  label,
  unit,
  tone = 'info',
  statusText,
  className,
}: VitalsGaugeProps) {
  const percentage = useMemo(() => {
    const clamped = Math.min(max, Math.max(min, value));
    return ((clamped - min) / (max - min)) * 100;
  }, [value, min, max]);

  // Semicircle gauge: 180 degrees arc (from -180 deg to 0 deg)
  const radius = 64;
  const strokeWidth = 10;
  const arcLength = Math.PI * radius; // 180 deg circumference
  const strokeDashoffset = arcLength - (percentage / 100) * arcLength;

  // Target range indicators
  const targetStartPct = targetMin ? ((targetMin - min) / (max - min)) * 100 : null;
  const targetEndPct = targetMax ? ((targetMax - min) / (max - min)) * 100 : null;

  return (
    <div
      className={twMerge(
        clsx(
          'relative p-4 rounded-2xl border border-line bg-surface-raised shadow-card flex flex-col items-center justify-center select-none overflow-hidden',
          className
        )
      )}
    >
      <div className="relative w-40 h-24 flex items-end justify-center">
        <svg
          viewBox="0 0 160 90"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          {/* Background Track */}
          <path
            d="M 16 80 A 64 64 0 0 1 144 80"
            fill="none"
            stroke="var(--line)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Optimal Target Zone Highlight (if provided) */}
          {targetStartPct !== null && targetEndPct !== null && (
            <path
              d="M 16 80 A 64 64 0 0 1 144 80"
              fill="none"
              stroke="var(--ok-border)"
              strokeWidth={strokeWidth}
              strokeDasharray={arcLength}
              strokeDashoffset={arcLength - ((targetEndPct - targetStartPct) / 100) * arcLength}
              strokeLinecap="butt"
              className="opacity-40"
            />
          )}

          {/* Animated Value Arc */}
          <motion.path
            d="M 16 80 A 64 64 0 0 1 144 80"
            fill="none"
            stroke={TONE_COLORS[tone]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center text-center">
          <div className="text-2xl font-extrabold text-content tracking-tight leading-none">
            <RollingNumber value={value} duration={600} />
            <span className="text-xs font-semibold text-content-muted ml-1">{unit}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-center">
        <span className="text-xs font-bold text-content block">{label}</span>
        {statusText && (
          <span
            className={clsx(
              'text-2xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 border',
              tone === 'ok' && 'bg-ok-bg text-ok-text border-ok-border',
              tone === 'warn' && 'bg-warn-bg text-warn-text border-warn-border',
              tone === 'risk' && 'bg-risk-bg text-risk-text border-risk-border',
              tone === 'info' && 'bg-info-bg text-info-text border-info-border'
            )}
          >
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
}
