import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, children, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(
              'w-full h-11 min-h-[44px] appearance-none rounded-[var(--radius-md)] border border-ink-300 bg-white pl-3.5 pr-10 text-base sm:text-sm text-ink-900',
              'transition-colors focus:border-brand-600 focus:outline-2 focus:outline-offset-2 focus:outline-brand-600',
              'disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed',
              'aria-[invalid=true]:border-risk-border aria-[invalid=true]:focus:outline-risk-text',
              className
            )
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="pointer-events-none absolute right-3.5 text-ink-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
