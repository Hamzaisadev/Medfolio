import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

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
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <RadixDialog.Content
          className={twMerge(
            clsx(
              // Mobile (<768px): Bottom sheet
              'fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] rounded-t-[var(--radius-xl)] bg-white p-6 shadow-[var(--shadow-over)] overflow-y-auto focus:outline-none',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-200',
              // Desktop (≥768px): Side drawer
              'md:bottom-0 md:top-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-full md:max-w-md md:rounded-l-[var(--radius-xl)] md:rounded-tr-none',
              'md:data-[state=closed]:slide-out-to-right md:data-[state=open]:slide-in-from-right',
              className
            )
          )}
        >
          {/* Visual Grab Handle on Mobile */}
          <div className="md:hidden mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-ink-300" aria-hidden="true" />

          <div className="flex items-center justify-between pb-3 border-b border-ink-200">
            <RadixDialog.Title className="text-lg font-bold text-ink-900">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-[var(--radius-sm)] p-1 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </RadixDialog.Close>
          </div>

          {description && (
            <RadixDialog.Description className="text-sm text-ink-600 my-2">
              {description}
            </RadixDialog.Description>
          )}

          <div className="py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
