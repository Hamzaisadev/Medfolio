import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, HTMLMotionProps } from 'motion/react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Stretches to the container width — the default for primary mobile actions. */
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      leftIcon,
      rightIcon,
      fullWidth,
      type = 'button',
      onClick,
      ...props
    },
    ref
  ) => {
    const baseStyles = clsx(
      'inline-flex items-center justify-center font-semibold select-none cursor-pointer',
      'rounded-[var(--radius-md)] transition-[background-color,border-color,color,box-shadow]',
      'duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    );

    const sizeStyles = {
      sm: 'h-10 min-h-10 px-3.5 text-xs gap-1.5',
      md: 'h-12 min-h-12 px-5 text-sm gap-2',
      lg: 'h-14 min-h-14 px-7 text-base gap-2.5',
    };

    const variantStyles = {
      primary:
        'bg-accent text-content-onaccent hover:bg-accent-hover active:bg-accent-active shadow-card',
      secondary:
        'bg-surface-raised text-content border border-line hover:bg-surface-hover hover:border-line-strong shadow-card',
      subtle: 'bg-accent-subtle text-accent-onsubtle hover:brightness-[0.97] border border-transparent',
      ghost: 'bg-transparent text-content-muted hover:bg-surface-hover hover:text-content',
      danger: 'bg-risk-bg text-risk-text border border-risk-border hover:brightness-[0.97]',
    };

    const isInteractive = !disabled && !loading;

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading}
        whileTap={isInteractive ? { scale: 0.96 } : undefined}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onClick={onClick}
        className={twMerge(
          clsx(
            baseStyles,
            sizeStyles[size],
            variantStyles[variant],
            fullWidth && 'w-full',
            className
          )
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children != null && children !== '' && <span>{children}</span>}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
