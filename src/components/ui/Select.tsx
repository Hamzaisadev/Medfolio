import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { controlStyles, controlHeight } from './Input';
import { ChevronDownIcon } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, children, disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={twMerge(
            clsx(controlStyles, controlHeight, 'appearance-none pl-3.5 pr-11', className)
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="pointer-events-none absolute right-3.5 text-content-subtle">
          <ChevronDownIcon size={16} />
        </div>
      </div>
    );
  }
);

Select.displayName = 'Select';
