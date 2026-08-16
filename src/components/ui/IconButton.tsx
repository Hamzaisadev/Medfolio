import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string; // Mandatory for accessibility
  variant?: 'ghost' | 'secondary' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'md',
      disabled,
      children,
      type = 'button',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-[var(--radius-md)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:cursor-not-allowed';

    // 44px minimum hit area enforced across all sizes
    const sizeStyles = {
      sm: 'w-11 h-11 min-w-[44px] min-h-[44px] p-2 text-sm',
      md: 'w-11 h-11 min-w-[44px] min-h-[44px] p-2.5 text-base',
      lg: 'w-12 h-12 min-w-[48px] min-h-[48px] p-3 text-lg',
    };

    const variantStyles = {
      ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200',
      secondary: 'bg-white text-ink-900 border border-ink-200 hover:bg-ink-100 active:bg-ink-200 shadow-[var(--shadow-card)]',
      primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-[var(--shadow-card)]',
      danger: 'bg-risk-bg text-risk-text border border-risk-border hover:bg-red-100 active:bg-red-200',
    };

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={disabled}
        className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
