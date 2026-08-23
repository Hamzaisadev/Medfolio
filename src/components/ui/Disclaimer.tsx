import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InfoIcon } from './icons';

export interface DisclaimerProps {
  text: string;
  className?: string;
}

export function Disclaimer({ text, className }: DisclaimerProps) {
  return (
    <aside
      className={twMerge(
        clsx(
          'flex items-start gap-2.5 p-3.5 rounded-[var(--radius-md)]',
          'border border-line bg-surface-sunken text-xs text-content-muted',
          className
        )
      )}
      role="note"
      aria-label="Medical disclaimer"
    >
      <InfoIcon size={16} className="shrink-0 text-content-subtle mt-px" />
      <p className="leading-relaxed">{text}</p>
    </aside>
  );
}
