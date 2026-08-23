import { useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircleIcon, AlertTriangleIcon, AlertCircleIcon, InfoIcon, XIcon } from './icons';

export interface ToastProps {
  open: boolean;
  onClose: () => void;
  message: string;
  tone?: 'info' | 'ok' | 'warn' | 'risk';
  durationMs?: number;
}

const toneStyles = {
  ok: 'bg-ok-bg text-ok-text border-ok-border',
  info: 'bg-info-bg text-info-text border-info-border',
  warn: 'bg-warn-bg text-warn-text border-warn-border',
  risk: 'bg-risk-bg text-risk-text border-risk-border',
};

function toneIcon(tone: NonNullable<ToastProps['tone']>) {
  switch (tone) {
    case 'ok':
      return <CheckCircleIcon size={18} />;
    case 'warn':
      return <AlertTriangleIcon size={18} />;
    case 'risk':
      return <AlertCircleIcon size={18} />;
    default:
      return <InfoIcon size={18} />;
  }
}

export function Toast({ open, onClose, message, tone = 'ok', durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      className={twMerge(
        clsx(
          'fixed z-50 flex items-start gap-3 px-4 py-3.5 rounded-[var(--radius-lg)]',
          'border shadow-raise text-sm font-medium',
          // Above the bottom nav on mobile; top-right on desktop.
          'bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 right-4',
          'md:bottom-auto md:top-6 md:left-auto md:right-6 md:max-w-sm',
          'animate-in fade-in-0 slide-in-from-bottom-3 md:slide-in-from-top-3',
          toneStyles[tone]
        )
      )}
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0 mt-px">{toneIcon(tone)}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-[var(--radius-sm)] opacity-70 hover:opacity-100 transition-opacity"
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}
