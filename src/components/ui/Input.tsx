import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="absolute left-3.5 text-ink-400 pointer-events-none shrink-0 flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(
              'w-full h-11 min-h-[44px] rounded-[var(--radius-md)] border border-ink-300 bg-white px-3.5 text-base sm:text-sm text-ink-900 placeholder:text-ink-400',
              'transition-colors focus:border-brand-600 focus:outline-2 focus:outline-offset-2 focus:outline-brand-600',
              'disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed',
              'aria-[invalid=true]:border-risk-border aria-[invalid=true]:focus:outline-risk-text',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3.5 text-ink-400 pointer-events-none shrink-0 flex items-center">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
