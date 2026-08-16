import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DisclaimerProps {
  text: string;
  className?: string;
}

export function Disclaimer({ text, className }: DisclaimerProps) {
  return (
    <aside
      className={twMerge(
        clsx(
          'flex items-start gap-2 p-3 rounded-[var(--radius-md)] border border-ink-200 bg-ink-50/70 text-xs text-ink-600',
          className
        )
      )}
      role="note"
      aria-label="Medical disclaimer"
    >
      <svg className="w-4 h-4 shrink-0 text-ink-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="leading-relaxed">{text}</p>
    </aside>
  );
}
