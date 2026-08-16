import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface StatProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function Stat({ label, value, subtext, icon, className }: StatProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'p-4 rounded-[var(--radius-lg)] border border-ink-200 bg-white shadow-[var(--shadow-card)] flex items-start justify-between',
          className
        )
      )}
    >
      <div>
        <p className="text-xs font-medium text-ink-500 uppercase tracking-wider">{label}</p>
        <p className="mt-1 text-2xl font-bold text-ink-900 tracking-tight">{value}</p>
        {subtext && <p className="mt-0.5 text-xs text-ink-600">{subtext}</p>}
      </div>
      {icon && <div className="text-brand-600 shrink-0 p-2 rounded-md bg-brand-50">{icon}</div>}
    </div>
  );
}
