import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SectionHeaderProps {
  title: string;
  /** Right-aligned supporting text, e.g. a time window or a count. */
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Tints the icon and rule — used to carry time-of-day meaning. */
  tone?: 'default' | 'morning' | 'afternoon' | 'evening' | 'night';
  className?: string;
}

const toneStyles = {
  default: { icon: 'text-content-subtle bg-surface-sunken border border-line' },
  morning: { icon: 'text-slot-morning-text bg-slot-morning-bg border border-slot-morning-border' },
  afternoon: {
    icon: 'text-slot-afternoon-text bg-slot-afternoon-bg border border-slot-afternoon-border',
  },
  evening: { icon: 'text-slot-evening-text bg-slot-evening-bg border border-slot-evening-border' },
  night: { icon: 'text-slot-night-text bg-slot-night-bg border border-slot-night-border' },
};

/**
 * Clean, structured section divider used between groups on a screen.
 */
export function SectionHeader({
  title,
  meta,
  icon,
  action,
  tone = 'default',
  className,
}: SectionHeaderProps) {
  const styles = toneStyles[tone];

  return (
    <div className={twMerge(clsx('flex items-center justify-between gap-3 py-1', className))}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span
            className={clsx(
              'shrink-0 flex items-center justify-center w-8 h-8 rounded-xl shadow-2xs',
              styles.icon
            )}
          >
            {icon}
          </span>
        )}

        <h2 className="text-xs sm:text-sm font-black text-content uppercase tracking-wider shrink-0">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {meta && <div className="text-xs text-content-subtle font-medium">{meta}</div>}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
