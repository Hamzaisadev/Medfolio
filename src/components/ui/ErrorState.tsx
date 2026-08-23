import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button';
import { AlertTriangleIcon } from './icons';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  fallbackAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = 'Unable to load clinical records',
  message,
  onRetry,
  fallbackAction,
  className,
  compact = false,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div
        className={twMerge(
          clsx(
            'flex items-center justify-between gap-3 p-3.5 rounded-[var(--radius-md)]',
            'border border-risk-border bg-risk-bg text-risk-text text-xs',
            className
          )
        )}
        role="alert"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangleIcon size={16} className="shrink-0" />
          <span className="truncate font-medium">{message}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 text-2xs font-bold rounded-[var(--radius-sm)] border border-risk-border hover:bg-risk-border/30 transition-colors shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center text-center px-6 py-10 sm:py-12',
          'rounded-[var(--radius-xl)] border border-risk-border bg-risk-bg/40',
          className
        )
      )}
      role="alert"
    >
      <div className="mb-4 w-14 h-14 rounded-[var(--radius-lg)] bg-risk-bg border border-risk-border text-risk-text flex items-center justify-center">
        <AlertTriangleIcon size={26} />
      </div>

      <h3 className="text-lg font-bold text-content tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-content-muted max-w-sm leading-relaxed">{message}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        )}
        {fallbackAction}
      </div>
    </div>
  );
}
