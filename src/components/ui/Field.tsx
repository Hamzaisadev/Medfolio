import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AlertCircleIcon } from './icons';

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={twMerge(clsx('flex flex-col gap-2', className))}>
      <label htmlFor={id} className="text-sm font-semibold text-content">
        {label}
        {required && (
          <span className="ml-1 text-risk-text" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {React.isValidElement(children) &&
        React.cloneElement(
          children as React.ReactElement<{
            id?: string;
            'aria-describedby'?: string;
            'aria-invalid'?: boolean;
          }>,
          {
            id,
            'aria-describedby': describedBy,
            'aria-invalid': Boolean(error),
          }
        )}

      {hint && !error && (
        <p id={hintId} className="text-xs text-content-subtle">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="text-xs font-medium text-risk-text flex items-start gap-1.5"
          role="alert"
        >
          <AlertCircleIcon size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
