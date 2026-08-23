import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'risk';
  className?: string;
}

const iconTone: Record<NonNullable<StatProps['tone']>, string> = {
  neutral: 'text-content-muted bg-surface-hover',
  accent: 'text-accent bg-accent-subtle',
  ok: 'text-ok-text bg-ok-bg',
  warn: 'text-warn-text bg-warn-bg',
  risk: 'text-risk-text bg-risk-bg',
};

export function Stat({ label, value, subtext, icon, tone = 'accent', className }: StatProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'p-4 rounded-[var(--radius-lg)] border border-line bg-surface-raised shadow-card',
          'flex items-start justify-between gap-3',
          className
        )
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-content-subtle uppercase tracking-wide">{label}</p>
        <p className="mt-1.5 text-2xl font-bold text-content tracking-tight" data-numeric>
          {value}
        </p>
        {subtext && <p className="mt-1 text-xs text-content-muted">{subtext}</p>}
      </div>
      {icon && (
        <div className={clsx('shrink-0 p-2.5 rounded-[var(--radius-md)]', iconTone[tone])}>
          {icon}
        </div>
      )}
    </div>
  );
}
