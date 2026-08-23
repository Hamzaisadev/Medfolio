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

export function EmptyState({ icon, heading, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center text-center px-6 py-12',
          'rounded-[var(--radius-xl)] border border-dashed border-line-strong bg-surface-raised/60',
          className
        )
      )}
    >
      <div className="mb-5 text-accent flex items-center justify-center">
        {icon || <EmptyIllustration className="w-28 h-24" />}
      </div>
      <h3 className="text-lg font-bold text-content tracking-tight">{heading}</h3>
      <p className="mt-2 text-sm text-content-muted max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
