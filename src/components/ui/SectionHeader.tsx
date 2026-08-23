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
  default: { icon: 'text-content-subtle bg-surface-hover', rule: 'bg-line' },
  morning: { icon: 'text-slot-morning-text bg-slot-morning-bg', rule: 'bg-slot-morning-border' },
  afternoon: {
    icon: 'text-slot-afternoon-text bg-slot-afternoon-bg',
    rule: 'bg-slot-afternoon-border',
  },
  evening: { icon: 'text-slot-evening-text bg-slot-evening-bg', rule: 'bg-slot-evening-border' },
  night: { icon: 'text-slot-night-text bg-slot-night-bg', rule: 'bg-slot-night-border' },
};

/**
 * Section divider used between groups on a screen.
 *
 * Replaces the ad-hoc `flex items-center justify-between pb-1 border-b` blocks
 * that each screen wrote slightly differently.
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
    <div className={twMerge(clsx('flex items-center gap-3', className))}>
      {icon && (
        <span
          className={clsx(
            'shrink-0 flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)]',
            styles.icon
          )}
        >
          {icon}
        </span>
      )}

      <h2 className="text-sm font-bold text-content uppercase tracking-wide shrink-0">{title}</h2>

      <span className={clsx('flex-1 h-px', styles.rule)} aria-hidden="true" />

      {meta && <span className="shrink-0 text-xs text-content-subtle font-medium">{meta}</span>}
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}
