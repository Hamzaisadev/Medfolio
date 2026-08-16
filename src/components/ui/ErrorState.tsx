import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './Button';

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
            'flex items-center justify-between gap-3 p-3 rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-950 text-xs shadow-2xs',
            className
          )
        )}
        role="alert"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-rose-200/80 text-rose-800 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="truncate font-medium">{message}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-200/70 hover:bg-rose-200 text-rose-900 transition-colors shrink-0"
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
          'relative overflow-hidden flex flex-col items-center justify-center text-center p-8 sm:p-10 rounded-2xl border border-rose-200/70 bg-linear-to-b from-rose-50/60 to-white shadow-sm',
          className
        )
      )}
      role="alert"
    >
      {/* Background soft glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/30 rounded-full blur-2xl pointer-events-none" />

      {/* Pulsing Alert Icon */}
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100/80 border border-rose-200 text-rose-700 flex items-center justify-center shadow-xs">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500" />
        </span>
      </div>

      <h3 className="text-base font-bold text-ink-900 tracking-tight">{title}</h3>
      <p className="mt-1.5 text-xs sm:text-sm text-ink-600 max-w-sm leading-relaxed">{message}</p>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {onRetry && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            className="bg-rose-700 hover:bg-rose-800 text-white shadow-xs"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </Button>
        )}
        {fallbackAction}
      </div>
    </div>
  );
}
