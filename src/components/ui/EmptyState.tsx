import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EmptyIllustration } from './icons';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  heading,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center text-center p-8 rounded-[var(--radius-lg)] border border-dashed border-ink-300 bg-white/50',
          className
        )
      )}
    >
      <div className="mb-4 text-brand-600 flex items-center justify-center">
        {icon || <EmptyIllustration className="w-24 h-24" />}
      </div>
      <h3 className="text-base font-bold text-ink-900 tracking-tight">{heading}</h3>
      <p className="mt-1 text-sm text-ink-600 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
