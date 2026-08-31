import { useRef, useEffect, useState, useCallback } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const Tabs = RadixTabs.Root;

export interface TabsListProps extends RadixTabs.TabsListProps {
  className?: string;
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const updateIndicator = useCallback(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-state="active"]');
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        opacity: 1,
      });
    }
  }, []);

  useEffect(() => {
    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    const observer = new MutationObserver(updateIndicator);
    if (listRef.current) {
      observer.observe(listRef.current, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-state'],
      });
    }
    window.addEventListener('resize', updateIndicator);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <RadixTabs.List
      ref={listRef}
      className={twMerge(
        clsx(
          'relative inline-flex items-center justify-start gap-1 w-full sm:w-auto',
          'rounded-[var(--radius-lg)] bg-surface-sunken border border-line p-1 text-content-muted',
          'overflow-x-auto scrollbar-none',
          className
        )
      )}
      {...props}
    >
      {/* iOS Sliding Pill Active Indicator */}
      <div
        className="absolute bg-surface-raised border border-line-strong shadow-card rounded-[var(--radius-md)] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] z-0"
        style={{
          transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
          width: `${indicatorStyle.width}px`,
          height: `${indicatorStyle.height}px`,
          opacity: indicatorStyle.opacity,
          top: 0,
          left: 0,
        }}
      />
      {children}
    </RadixTabs.List>
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
          'relative z-10 inline-flex flex-1 sm:flex-initial h-10 items-center justify-center whitespace-nowrap',
          'rounded-[var(--radius-md)] px-4 text-sm font-semibold select-none cursor-pointer',
          'transition-colors duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-50',
          'hover:text-content',
          'data-[state=active]:text-content data-[state=active]:font-bold',
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
