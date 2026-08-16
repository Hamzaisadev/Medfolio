import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, disabled, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={twMerge(
          clsx(
            'w-full min-h-[88px] rounded-[var(--radius-md)] border border-ink-300 bg-white p-3 text-base sm:text-sm text-ink-900 placeholder:text-ink-400',
            'transition-colors focus:border-brand-600 focus:outline-2 focus:outline-offset-2 focus:outline-brand-600',
            'disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed resize-y',
            'aria-[invalid=true]:border-risk-border aria-[invalid=true]:focus:outline-risk-text',
            className
          )
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
