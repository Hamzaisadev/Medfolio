import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  animate?: boolean;
}

const roundedMap = {
  sm: 'rounded-[var(--radius-sm)]',
  md: 'rounded-[var(--radius-md)]',
  lg: 'rounded-[var(--radius-lg)]',
  xl: 'rounded-[var(--radius-xl)]',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

/**
 * Premium Kinetic Skeleton Loader.
 * Features a silky gradient shimmer wave across a subtle surface rather than tacky blinking pulses.
 */
export function Skeleton({
  className,
  rounded = 'md',
  animate = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'relative overflow-hidden bg-surface-sunken/80 border border-line/40',
          roundedMap[rounded],
          className
        )
      )}
      aria-hidden="true"
      {...props}
    >
      {animate && (
        <motion.div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent pointer-events-none"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: [0.4, 0, 0.2, 1],
            repeatDelay: 0.2,
          }}
        />
      )}
    </div>
  );
}

/**
 * Skeleton placeholder for Metric Cards on Dashboard / Vitals.
 */
export function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div className={twMerge('p-4 sm:p-5 rounded-[var(--radius-xl)] border border-line bg-surface-raised/95 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

/**
 * Skeleton placeholder for Dose / Prescription Cards.
 */
export function SkeletonCardItem({ className }: { className?: string }) {
  return (
    <div className={twMerge('p-5 rounded-[var(--radius-xl)] border border-line bg-surface-raised/95 space-y-3', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-10 w-16 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-52" />
      <div className="flex items-center gap-2 pt-2 border-t border-line">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}
