import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Tabs = RadixTabs.Root;

export interface TabsListProps extends RadixTabs.TabsListProps {
  className?: string;
}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <RadixTabs.List
      className={twMerge(
        clsx(
          'inline-flex h-11 items-center justify-start rounded-[var(--radius-lg)] bg-ink-100 p-1 text-ink-600 gap-1 w-full sm:w-auto',
          className
        )
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends RadixTabs.TabsTriggerProps {
  className?: string;
}

export function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={twMerge(
        clsx(
          'inline-flex flex-1 sm:flex-initial h-9 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] px-4 text-sm font-medium transition-all select-none',
          'focus-visible:outline-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-50',
          'data-[state=active]:bg-white data-[state=active]:text-ink-900 data-[state=active]:shadow-[var(--shadow-card)]',
          className
        )
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends RadixTabs.TabsContentProps {
  className?: string;
}

export function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <RadixTabs.Content
      className={twMerge(
        clsx(
          'mt-4 focus-visible:outline-2 focus-visible:outline-brand-600',
          className
        )
      )}
      {...props}
    />
  );
}
