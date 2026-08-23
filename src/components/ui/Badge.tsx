import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon, InfoIcon } from './icons';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'risk' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  /**
   * Prefixes a tone-appropriate icon.
   *
   * Status must never be carried by colour alone — roughly 1 in 12 men has a
   * colour vision deficiency, and "out of range" on a lab result is not
   * information anyone should be guessing at.
   */
  withIcon?: boolean;
  icon?: React.ReactNode;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-surface-hover text-content-muted border-line',
  ok: 'bg-ok-bg text-ok-text border-ok-border',
  warn: 'bg-warn-bg text-warn-text border-warn-border',
  risk: 'bg-risk-bg text-risk-text border-risk-border',
  info: 'bg-info-bg text-info-text border-info-border',
};

function defaultIcon(tone: BadgeTone, size: number) {
  switch (tone) {
    case 'ok':
      return <CheckCircleIcon size={size} />;
    case 'warn':
      return <AlertTriangleIcon size={size} />;
    case 'risk':
      return <AlertCircleIcon size={size} />;
    case 'info':
      return <InfoIcon size={size} />;
    default:
      return null;
  }
}

export function Badge({
  className,
  tone = 'neutral',
  size = 'md',
  withIcon = false,
  icon,
  children,
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'px-2 py-0.5 text-2xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  const glyph = icon ?? (withIcon ? defaultIcon(tone, size === 'sm' ? 11 : 13) : null);

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center font-semibold rounded-full border whitespace-nowrap',
          toneStyles[tone],
          sizeStyles[size],
          className
        )
      )}
      {...props}
    >
      {glyph && <span className="shrink-0">{glyph}</span>}
      {children}
    </span>
  );
}
