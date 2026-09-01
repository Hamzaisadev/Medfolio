import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowRightIcon } from './icons';
import { RollingNumber } from './RollingNumber';

export type MetricTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'risk';

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  /** Supporting line under the value. */
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: MetricTone;
  /** Turns the whole card into a link. */
  to?: string;
  /** Right-aligned slot in the header, e.g. a Badge. */
  trailing?: ReactNode;
  className?: string;
}

const iconTone: Record<MetricTone, string> = {
  neutral: 'text-content-muted bg-surface-hover',
  accent: 'text-accent bg-accent-subtle',
  ok: 'text-ok-text bg-ok-bg',
  warn: 'text-warn-text bg-warn-bg',
  risk: 'text-risk-text bg-risk-bg',
};

/**
 * A single headline number with context and smooth spring hover lift.
 */
export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'accent',
  to,
  trailing,
  className,
}: MetricCardProps) {
  const displayValue = typeof value === 'number' ? <RollingNumber value={value} /> : value;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span
              className={clsx(
                'shrink-0 flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] transition-colors',
                iconTone[tone]
              )}
            >
              {icon}
            </span>
          )}
          <p className="text-xs font-semibold text-content-subtle uppercase tracking-wide truncate">
            {label}
          </p>
        </div>
        {trailing && <span className="shrink-0">{trailing}</span>}
        {!trailing && to && (
          <ArrowRightIcon
            size={16}
            className="shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5"
          />
        )}
      </div>

      <p className="mt-3 text-2xl font-bold text-content tracking-tight" data-numeric>
        {displayValue}
      </p>
      {detail && <p className="mt-1 text-xs text-content-muted leading-snug">{detail}</p>}
    </>
  );

  const shared = clsx(
    'block p-4 sm:p-5 rounded-[var(--radius-xl)] border border-line bg-surface-raised/95 backdrop-blur-md shadow-card transition-all duration-[var(--duration-base)]',
    className
  );

  if (to) {
    return (
      <Link
        to={to}
        className={clsx(
          shared,
          'group tap-spring hover:border-line-strong hover:shadow-raise hover:-translate-y-0.5',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={shared}>{body}</div>;
}
