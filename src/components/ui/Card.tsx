import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, header, footer, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'bg-white border border-ink-200 rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] overflow-hidden',
            className
          )
        )}
        {...props}
      >
        {header && <div className="px-5 py-4 border-b border-ink-200 bg-ink-50/50">{header}</div>}
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ink-200 bg-ink-50/50">{footer}</div>}
      </div>
    );
  }
);

Card.displayName = 'Card';
