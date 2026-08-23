import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { XIcon } from './icons';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Bottom sheet on mobile, right-hand drawer from the `md` breakpoint up. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: SheetProps) {
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
              'fixed z-50 bg-surface-raised shadow-over focus:outline-none flex flex-col',
              // Mobile: bottom sheet, capped so the handle is always reachable.
              'bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-[var(--radius-2xl)] border-t border-line',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
              'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
              // Desktop: side drawer.
              'md:inset-y-0 md:left-auto md:right-0 md:bottom-auto md:h-dvh md:max-h-none md:w-full md:max-w-md',
              'md:rounded-none md:rounded-l-[var(--radius-2xl)] md:border-t-0 md:border-l md:border-line',
              'md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right',
              className
            )
          )}
        >
          {/* Grab handle: signals the sheet is draggable/dismissable on touch. */}
          <div
            className="md:hidden mx-auto mt-3 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-line-strong"
            aria-hidden="true"
          />

          <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-3 border-b border-line shrink-0">
            <div className="min-w-0">
              <RadixDialog.Title className="text-lg font-bold text-content tracking-tight">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-1 text-sm text-content-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="-mr-2 shrink-0 rounded-[var(--radius-sm)] p-2 text-content-subtle hover:text-content hover:bg-surface-hover transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <XIcon size={18} />
              </button>
            </RadixDialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
