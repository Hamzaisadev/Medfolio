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
          'inline-flex items-center justify-start gap-1 w-full sm:w-auto',
          'rounded-[var(--radius-lg)] bg-surface-sunken border border-line p-1 text-content-muted',
          // Many tab sets are long labels with counts; scroll rather than wrap on
          // a narrow screen, so the control keeps one predictable height.
          'overflow-x-auto scrollbar-none',
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
          'inline-flex flex-1 sm:flex-initial h-10 items-center justify-center whitespace-nowrap',
          'rounded-[var(--radius-md)] px-4 text-sm font-semibold select-none',
          'transition-[background-color,color,box-shadow] duration-[var(--duration-fast)]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-50',
          'hover:text-content',
          'data-[state=active]:bg-surface-raised data-[state=active]:text-content data-[state=active]:shadow-card',
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
          'mt-5 focus-visible:outline-2 focus-visible:outline-accent',
          'data-[state=active]:animate-in data-[state=active]:fade-in-0',
          className
        )
      )}
      {...props}
    />
  );
}
