import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { PlusIcon, MinusIcon } from './icons';

export interface RollerNumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  showNudgeButtons?: boolean;
  showQuickPills?: boolean;
}

/**
 * Modern Precision Value Scrubber & Stepper Input
 *
 * Features:
 * - Direct click-to-type input (always live, reliable, auto-selects on focus)
 * - Mouse wheel / trackpad scrolling over the input (+1/-1, Shift for +5/+10)
 * - Click & drag / touch horizontal scrubber
 * - Keyboard ArrowUp / ArrowDown steppers
 * - Tactile Minus / Plus nudge buttons
 */
export function RollerNumberInput({
  value,
  onChange,
  min = 0,
  max = 500,
  step = 1,
  label,
  unit,
  size = 'md',
  className,
  disabled = false,
  showNudgeButtons = true,
  showQuickPills = false,
}: RollerNumberInputProps) {
  const [inputValue, setInputValue] = useState<string>(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragStartXRef = useRef(0);
  const dragStartValueRef = useRef(value);

  // Sync internal string when external value updates while not focused
  useEffect(() => {
    if (!isFocused) {
      setInputValue(value.toString());
    }
  }, [value, isFocused]);

  const clamp = useCallback(
    (val: number) => {
      const rounded = step < 1 ? parseFloat(val.toFixed(1)) : Math.round(val / step) * step;
      return Math.min(Math.max(rounded, min), max);
    },
    [min, max, step]
  );

  const updateValue = useCallback(
    (newVal: number) => {
      const clamped = clamp(newVal);
      setInputValue(clamped.toString());
      onChange(clamped);
    },
    [clamp, onChange]
  );

  // Non-passive wheel event listener to prevent window scrolling when spinning wheel over input
  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const multiplier = e.shiftKey ? 5 : 1;
      const direction = e.deltaY < 0 ? 1 : -1;
      const delta = direction * step * multiplier;

      updateValue(value + delta);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [value, disabled, step, updateValue]);

  // Pointer drag scrubbing (horizontal swipe/drag on the badge/container)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || e.target === inputRef.current) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    dragStartXRef.current = e.clientX;
    dragStartValueRef.current = value;
    setIsDragging(true);
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;

    const deltaX = e.clientX - dragStartXRef.current;
    const pixelsPerStep = 10;
    const stepDelta = Math.trunc(deltaX / pixelsPerStep);

    if (stepDelta !== 0) {
      const multiplier = e.shiftKey ? 5 : 1;
      updateValue(dragStartValueRef.current + stepDelta * step * multiplier);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if released
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.min(Math.max(parsed, min), max);
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      setInputValue(value.toString());
    } else {
      updateValue(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const multiplier = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateValue(value + step * multiplier);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateValue(value - step * multiplier);
    } else if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
  };

  const sizeStyles = {
    sm: {
      btn: 'w-7 sm:w-8 h-8 sm:h-9 shrink-0',
      input: 'h-8 sm:h-9 text-sm sm:text-base font-bold w-12 sm:w-14 min-w-0',
      wrapper: 'gap-0.5 sm:gap-1 max-w-full',
      unit: 'text-2xs',
    },
    md: {
      btn: 'w-7.5 sm:w-9 h-9 sm:h-10 shrink-0',
      input: 'h-9 sm:h-10 text-base sm:text-lg font-bold w-12 sm:w-16 min-w-0',
      wrapper: 'gap-1 sm:gap-1.5 max-w-full',
      unit: 'text-xs',
    },
    lg: {
      btn: 'w-9 sm:w-11 h-11 sm:h-13 shrink-0',
      input: 'h-11 sm:h-13 text-2xl sm:text-3xl font-black w-20 sm:w-24 min-w-0',
      wrapper: 'gap-1.5 sm:gap-2 max-w-full',
      unit: 'text-sm font-bold',
    },
  }[size];

  return (
    <div className={clsx('flex flex-col items-center select-none', className)}>
      {label && (
        <span className="text-xs font-bold text-content-muted mb-1.5 flex items-center gap-1">
          {label}
        </span>
      )}

      {/* Main Stepper & Scrubbing Field */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={clsx(
          'relative flex items-center rounded-2xl border border-line bg-surface-sunken/60 p-1 transition-all',
          sizeStyles.wrapper,
          isDragging && 'border-accent ring-2 ring-accent/20 cursor-ew-resize',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Minus / Decrement Button */}
        {showNudgeButtons && (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || value <= min}
            onClick={() => updateValue(value - step)}
            aria-label={`Decrease ${label || 'value'}`}
            className={clsx(
              'rounded-xl border border-line bg-surface hover:bg-surface-hover active:scale-95 text-content flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs',
              sizeStyles.btn
            )}
          >
            <MinusIcon size={size === 'lg' ? 18 : 14} />
          </button>
        )}

        {/* Central Direct Input Box */}
        <div
          className={clsx(
            'flex items-center justify-center rounded-xl bg-surface border border-line px-2 transition-all shadow-2xs',
            isFocused && 'ring-2 ring-accent/30 border-accent'
          )}
        >
          <input
            ref={inputRef}
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={(e) => {
              setIsFocused(true);
              e.target.select();
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={clsx(
              'bg-transparent text-center text-content tracking-tight font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
              sizeStyles.input
            )}
          />
          {unit && (
            <span className={clsx('text-content-subtle font-medium shrink-0 ml-1 select-none', sizeStyles.unit)}>
              {unit}
            </span>
          )}
        </div>

        {/* Plus / Increment Button */}
        {showNudgeButtons && (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || value >= max}
            onClick={() => updateValue(value + step)}
            aria-label={`Increase ${label || 'value'}`}
            className={clsx(
              'rounded-xl border border-line bg-surface hover:bg-surface-hover active:scale-95 text-content flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs',
              sizeStyles.btn
            )}
          >
            <PlusIcon size={size === 'lg' ? 18 : 14} />
          </button>
        )}
      </div>

      {/* Quick Jump Pills (e.g. -10, -5, +5, +10) */}
      {showQuickPills && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {[-10, -5, 5, 10].map((delta) => (
            <button
              key={delta}
              type="button"
              tabIndex={-1}
              onClick={() => updateValue(value + delta)}
              className="px-2 py-1 rounded-lg text-2xs font-bold border border-line bg-surface-raised hover:bg-surface-hover text-content-muted hover:text-content active:scale-95 transition-all cursor-pointer"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
