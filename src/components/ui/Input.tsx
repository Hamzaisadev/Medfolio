import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Shared field-control styling.
 *
 * `text-base sm:text-sm` is deliberate: iOS zooms the viewport when a focused
 * input's font size is under 16px, so mobile keeps the larger size and only
 * desktop steps down.
 */
export const controlStyles = clsx(
  'w-full rounded-[var(--radius-md)] border border-line-strong bg-surface-raised',
  'text-base sm:text-sm text-content placeholder:text-content-subtle',
  'transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
  'focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent',
  'disabled:bg-surface-hover disabled:text-content-subtle disabled:cursor-not-allowed',
  'aria-[invalid=true]:border-risk-border aria-[invalid=true]:focus:outline-risk-text'
);

/** 48px: comfortably tappable without being oversized in a dense form. */
export const controlHeight = 'h-12 min-h-12';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="absolute left-3.5 text-content-subtle pointer-events-none shrink-0 flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(
              controlStyles,
              controlHeight,
              'px-3.5',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className
            )
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3.5 text-content-subtle pointer-events-none shrink-0 flex items-center">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
