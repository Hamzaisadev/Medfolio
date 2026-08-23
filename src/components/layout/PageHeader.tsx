import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  /** Small label above the title, e.g. a section name. */
  eyebrow?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <div className={twMerge(clsx('flex flex-col gap-3 mb-7', className))}>
      {breadcrumbs && <div className="text-xs text-content-subtle">{breadcrumbs}</div>}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wide text-accent mb-1.5">{eyebrow}</p>
          )}
          {/* One clear focal element per screen: the page title is the largest
              thing on it, which the previous 2xl-everywhere scale never achieved. */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content text-balance">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-content-muted leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {action && <div className="flex items-center gap-2.5 shrink-0">{action}</div>}
      </div>
    </div>
  );
}
