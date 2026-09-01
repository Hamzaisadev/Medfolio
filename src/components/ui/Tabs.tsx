import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';

export const Tabs = RadixTabs.Root;

export interface TabsListProps extends RadixTabs.TabsListProps {
  className?: string;
}

export function TabsList({ className, ...props }: TabsListProps) {
  return (
    <RadixTabs.List
      className={twMerge(
        clsx(
          'inline-flex items-center justify-start gap-1 w-full sm:w-auto relative',
          'rounded-[var(--radius-lg)] bg-surface-sunken border border-line p-1 text-content-muted',
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

export function TabsTrigger({ className, children, ...props }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      className={twMerge(
        clsx(
          'relative inline-flex flex-1 sm:flex-initial h-10 items-center justify-center whitespace-nowrap',
          'rounded-[var(--radius-md)] px-4 text-sm font-semibold select-none z-10 cursor-pointer',
          'transition-all duration-[var(--duration-fast)]',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-50',
          'hover:text-content text-content-muted',
          'data-[state=active]:text-content data-[state=active]:bg-surface-raised data-[state=active]:shadow-card',
          className
        )
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </RadixTabs.Trigger>
  );
}

export interface TabsContentProps extends RadixTabs.TabsContentProps {
  className?: string;
}

export function TabsContent({ className, children, ...props }: TabsContentProps) {
  return (
    <RadixTabs.Content
      className={twMerge(
        clsx(
          'mt-5 focus-visible:outline-2 focus-visible:outline-accent',
          className
        )
      )}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 450, damping: 32 }}
      >
        {children}
      </motion.div>
    </RadixTabs.Content>
  );
}
