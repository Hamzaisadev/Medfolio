import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'ok' | 'warn' | 'risk' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  tone = 'neutral',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const toneStyles = {
    neutral: 'bg-ink-100 text-ink-700 border-ink-200',
    ok: 'bg-ok-bg text-ok-text border-ok-border',
    warn: 'bg-warn-bg text-warn-text border-warn-border',
    risk: 'bg-risk-bg text-risk-text border-risk-border',
    info: 'bg-info-bg text-info-text border-info-border',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 font-medium rounded-full border',
          toneStyles[tone],
          sizeStyles[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
}
