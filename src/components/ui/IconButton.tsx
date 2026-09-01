import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, HTMLMotionProps } from 'motion/react';

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  'aria-label': string; // Mandatory for accessibility
  children?: React.ReactNode;
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
      onClick,
      ...props
    },
    ref
  ) => {
    const baseStyles = clsx(
      'inline-flex items-center justify-center rounded-[var(--radius-md)] cursor-pointer',
      'transition-[background-color,color] duration-[var(--duration-fast)]',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'
    );

    const sizeStyles = {
      sm: 'w-11 h-11 p-2',
      md: 'w-11 h-11 p-2.5',
      lg: 'w-12 h-12 p-3',
    };

    const variantStyles = {
      ghost: 'bg-transparent text-content-muted hover:bg-surface-hover hover:text-content',
      secondary: 'bg-surface-raised text-content border border-line hover:bg-surface-hover shadow-card',
      primary: 'bg-accent text-content-onaccent hover:bg-accent-hover shadow-card',
      danger: 'bg-risk-bg text-risk-text border border-risk-border hover:brightness-[0.97]',
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={disabled}
        whileTap={!disabled ? { scale: 0.92 } : undefined}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onClick={onClick}
        className={twMerge(clsx(baseStyles, sizeStyles[size], variantStyles[variant], className))}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';
