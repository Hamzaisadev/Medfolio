import React, { useRef, useEffect, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'teal' | 'brand';
  fullWidth?: boolean;
  className?: string;
  tabClassName?: string;
  'aria-label'?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onChange,
  options,
  size = 'md',
  tone = 'default',
  fullWidth = false,
  className,
  tabClassName,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const activeEl = container.querySelector<HTMLButtonElement>(`[data-tab-value="${value}"]`);
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        opacity: 1,
      });
    }
  }, [value]);

  useEffect(() => {
    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    return () => clearTimeout(timer);
  }, [updateIndicator, options]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const sizeClasses = {
    sm: 'h-8 text-xs px-3 rounded-lg gap-1.5',
    md: 'h-9.5 text-xs sm:text-sm px-3.5 rounded-xl gap-2',
    lg: 'h-11 text-sm sm:text-base px-4.5 rounded-xl gap-2.5',
  };

  const containerRadius = {
    sm: 'p-1 rounded-xl',
    md: 'p-1 rounded-2xl',
    lg: 'p-1.5 rounded-2xl',
  };

  const activeIndicatorTone = {
    default: 'bg-surface-raised border border-line-strong shadow-card text-content',
    teal: 'bg-surface-raised border border-teal-200/80 shadow-card text-teal-950',
    brand: 'bg-surface-raised border border-brand-200 shadow-card text-brand-900',
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={twMerge(
        clsx(
          'relative inline-flex items-center bg-surface-sunken border border-line select-none overflow-x-auto scrollbar-none',
          containerRadius[size],
          fullWidth ? 'w-full flex' : 'w-auto',
          className
        )
      )}
    >
      {/* Sliding Active Indicator with iOS Spring Physics */}
      <div
        className={clsx(
          'absolute rounded-[inherit] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none z-0',
          activeIndicatorTone[tone]
        )}
        style={{
          transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
          width: `${indicatorStyle.width}px`,
          height: `${indicatorStyle.height}px`,
          opacity: indicatorStyle.opacity,
          top: 0,
          left: 0,
        }}
      />

      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={opt.disabled}
            data-tab-value={opt.value}
            onClick={() => onChange(opt.value)}
            className={twMerge(
              clsx(
                'relative z-10 flex items-center justify-center font-bold tracking-tight whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent cursor-pointer',
                sizeClasses[size],
                fullWidth && 'flex-1',
                isActive
                  ? tone === 'teal'
                    ? 'text-teal-950'
                    : 'text-content'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover/30',
                opt.disabled && 'opacity-40 cursor-not-allowed',
                tabClassName
              )
            )}
          >
            {opt.icon && (
              <span className={clsx('transition-colors', isActive ? (tone === 'teal' ? 'text-teal-600' : 'text-accent') : 'text-content-subtle')}>
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
            {opt.badge && <span className="ml-1 shrink-0">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
