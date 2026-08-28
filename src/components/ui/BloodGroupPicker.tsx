import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDownIcon, XIcon } from './icons';

export interface BloodGroupPickerProps {
  id?: string;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function BloodGroupPicker({
  id,
  value,
  onChange,
  disabled = false,
  className,
  placeholder = 'Select type',
}: BloodGroupPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isSelected = Boolean(value);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={placeholder}
          className={twMerge(
            'h-12 w-full bg-surface-raised border border-line-strong rounded-[var(--radius-md)] px-3 text-xs sm:text-sm text-content flex items-center justify-between transition-all select-none cursor-pointer shadow-2xs',
            'hover:border-accent hover:bg-surface-hover focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isOpen && 'border-accent ring-2 ring-accent/20',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {isSelected ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent font-bold text-xs sm:text-sm">
                {value === 'unknown' ? 'Unknown' : value}
              </span>
            ) : (
              <span className="text-content-muted text-xs sm:text-sm truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1.5 text-content-subtle">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onChange('');
                  }
                }}
                className="p-1 rounded-md text-content-subtle hover:text-content hover:bg-surface-sunken transition cursor-pointer"
                aria-label="Clear blood type"
              >
                <XIcon size={12} />
              </span>
            )}
            <ChevronDownIcon
              size={14}
              className={clsx('text-content-subtle transition-transform duration-200', isOpen && 'rotate-180 text-accent')}
            />
          </div>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={{ top: 80, bottom: 24, left: 16, right: 16 }}
          avoidCollisions
          className="w-58 max-w-[calc(100vw-2rem)] p-2.5 rounded-2xl bg-surface-raised border border-line-strong shadow-over z-[100] animate-in fade-in zoom-in-95 duration-150 focus:outline-none"
        >
          <div className="text-[10px] font-bold text-content-subtle uppercase px-1 pb-1.5 mb-1.5 border-b border-line">
            Select Blood Group
          </div>

          {/* 4-column quick pill grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {BLOOD_TYPES.map((type) => {
              const isActive = value === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    onChange(type);
                    setIsOpen(false);
                  }}
                  className={clsx(
                    'h-9 rounded-lg text-xs font-bold flex items-center justify-center transition-all cursor-pointer select-none',
                    isActive
                      ? 'bg-accent text-accent-onaccent shadow-xs font-extrabold'
                      : 'bg-surface-hover text-content hover:bg-surface-sunken hover:text-accent'
                  )}
                >
                  {type}
                </button>
              );
            })}
          </div>

          {/* Unknown / Not tested option */}
          <div className="mt-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={() => {
                onChange('unknown');
                setIsOpen(false);
              }}
              className={clsx(
                'w-full h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer select-none',
                value === 'unknown'
                  ? 'bg-accent text-accent-onaccent shadow-xs font-bold'
                  : 'bg-surface-hover text-content-muted hover:text-content hover:bg-surface-sunken'
              )}
            >
              Unknown / Not tested
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
