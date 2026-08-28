import React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { controlStyles, controlHeight } from './Input';
import { ChevronDownIcon, CheckIcon } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  options?: SelectOption[];
  disabled?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onValueChange?: (value: string) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      id,
      name,
      value,
      defaultValue,
      placeholder = 'Select an option',
      options = [],
      disabled = false,
      className,
      onChange,
      onValueChange,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    ref
  ) => {
    const handleValueChange = (val: string) => {
      onValueChange?.(val);
      if (onChange) {
        const syntheticEvent = {
          target: { value: val, name: name || id || '' },
          currentTarget: { value: val, name: name || id || '' },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(syntheticEvent);
      }
    };

    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : value;

    return (
      <RadixSelect.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <RadixSelect.Trigger
          ref={ref}
          id={id}
          name={name}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={twMerge(
            clsx(
              controlStyles,
              controlHeight,
              'flex items-center justify-between px-3.5 text-left cursor-pointer select-none shadow-2xs',
              'data-[placeholder]:text-content-subtle',
              className
            )
          )}
        >
          <RadixSelect.Value placeholder={placeholder}>
            {displayLabel || placeholder}
          </RadixSelect.Value>
          <RadixSelect.Icon asChild>
            <ChevronDownIcon size={16} className="text-content-subtle shrink-0 ml-2" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            collisionPadding={{ top: 80, bottom: 24, left: 16, right: 16 }}
            avoidCollisions
            className="z-[100] min-w-[var(--radix-select-trigger-width)] max-h-[280px] overflow-hidden rounded-2xl bg-surface-raised border border-line-strong shadow-over p-1 animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
          >
            <RadixSelect.Viewport className="p-1 space-y-0.5 overflow-y-auto max-h-[260px]">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <RadixSelect.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className={clsx(
                      'relative flex items-center justify-between px-3 py-2 text-xs sm:text-sm font-medium rounded-xl text-content cursor-pointer select-none outline-none transition-colors',
                      'hover:bg-surface-hover hover:text-accent focus:bg-accent/10 focus:text-accent data-[highlighted]:bg-accent/10 data-[highlighted]:text-accent',
                      isSelected &&
                        'bg-accent text-accent-onaccent font-bold hover:bg-accent hover:text-accent-onaccent focus:bg-accent focus:text-accent-onaccent data-[highlighted]:bg-accent data-[highlighted]:text-accent-onaccent',
                      opt.disabled && 'opacity-50 pointer-events-none'
                    )}
                  >
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator>
                      <CheckIcon size={14} className="shrink-0 ml-2" />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                );
              })}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    );
  }
);

Select.displayName = 'Select';
