import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { XIcon } from './icons';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={clsx(
            'fixed inset-0 z-50 bg-ink-950/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
          )}
        />
        <RadixDialog.Content
          className={twMerge(
            clsx(
              'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
              'max-h-[calc(100dvh-3rem)] overflow-y-auto',
              'rounded-[var(--radius-xl)] bg-surface-raised border border-line p-6 shadow-over focus:outline-none',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              className
            )
          )}
        >
          <div className="flex items-start justify-between gap-4 pb-3">
            <RadixDialog.Title className="text-lg font-bold text-content tracking-tight">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mr-2 -mt-1 shrink-0 rounded-[var(--radius-sm)] p-2 text-content-subtle hover:text-content hover:bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <XIcon size={18} />
              </button>
            </RadixDialog.Close>
          </div>

          {description && (
            <RadixDialog.Description className="text-sm text-content-muted leading-relaxed">
              {description}
            </RadixDialog.Description>
          )}

          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
