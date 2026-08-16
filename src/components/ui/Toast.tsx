import { useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ToastProps {
  open: boolean;
  onClose: () => void;
  message: string;
  tone?: 'info' | 'ok' | 'warn' | 'risk';
  durationMs?: number;
}

export function Toast({
  open,
  onClose,
  message,
  tone = 'ok',
  durationMs = 5000,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const toneStyles = {
    ok: 'bg-ink-900 text-white border-ink-800',
    info: 'bg-info-bg text-info-text border-info-border',
    warn: 'bg-warn-bg text-warn-text border-warn-border',
    risk: 'bg-risk-bg text-risk-text border-risk-border',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'fixed z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-[var(--radius-lg)] shadow-[var(--shadow-raise)] border text-sm font-medium',
          // Bottom on mobile (<768px), top-right on desktop (≥768px) per design contract
          'bottom-20 left-4 right-4 md:bottom-auto md:top-6 md:left-auto md:right-6 md:max-w-sm',
          'animate-in fade-in slide-in-from-bottom-3 md:slide-in-from-top-3 duration-200',
          toneStyles[tone]
        )
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss toast"
        className="opacity-70 hover:opacity-100 p-1 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
