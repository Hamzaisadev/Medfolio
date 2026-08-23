import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { controlStyles } from './Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, disabled, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={twMerge(clsx(controlStyles, 'min-h-24 p-3.5 resize-y', className))}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
