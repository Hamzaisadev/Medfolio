import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type CardAccent = 'none' | 'accent' | 'ok' | 'warn' | 'risk' | 'info' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Draws a coloured rail down the leading edge. Used to carry time-of-day or
   * status meaning without tinting the whole surface, which is hard to keep
   * readable in dark mode.
   */
  accent?: CardAccent;
  /** Removes the default body padding for cards that manage their own layout. */
  bare?: boolean;
}

const accentRail: Record<CardAccent, string> = {
  none: '',
  accent: 'before:bg-accent',
  ok: 'before:bg-ok-border',
  warn: 'before:bg-warn-border',
  risk: 'before:bg-risk-border',
  info: 'before:bg-info-border',
  morning: 'before:bg-slot-morning-border',
  afternoon: 'before:bg-slot-afternoon-border',
  evening: 'before:bg-slot-evening-border',
  night: 'before:bg-slot-night-border',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, header, footer, children, accent = 'none', bare, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'relative bg-surface-raised/95 backdrop-blur-md border border-line rounded-[var(--radius-xl)]',
            'shadow-card hover:border-line-strong transition-all duration-[var(--duration-base)] overflow-hidden',
            accent !== 'none' && [
              'before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:content-[""]',
              accentRail[accent],
            ],
            className
          )
        )}
        {...props}
      >
        {header && (
          <div className="px-5 py-4 border-b border-line bg-surface-sunken/60">{header}</div>
        )}
        <div className={bare ? '' : 'p-5'}>{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-line bg-surface-sunken/60">{footer}</div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';
