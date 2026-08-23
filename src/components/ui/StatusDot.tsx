import { clsx } from 'clsx';

export type StatusDotTone = 'neutral' | 'ok' | 'warn' | 'risk' | 'info' | 'accent';

export interface StatusDotProps {
  tone?: StatusDotTone;
  /** Adds a soft pulse. Reserve for something genuinely live or overdue. */
  pulse?: boolean;
  size?: number;
  /**
   * Screen-reader text. A dot is decoration unless it is labelled, and status
   * carried only by a coloured dot is invisible to anyone who cannot see it.
   */
  label?: string;
  className?: string;
}

const toneStyles: Record<StatusDotTone, string> = {
  neutral: 'bg-content-subtle',
  ok: 'bg-ok-text',
  warn: 'bg-warn-text',
  risk: 'bg-risk-text',
  info: 'bg-info-text',
  accent: 'bg-accent',
};

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  size = 8,
  label,
  className,
}: StatusDotProps) {
  return (
    <span className={clsx('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      {pulse && (
        <span
          className={clsx('absolute inset-0 rounded-full animate-ping opacity-60', toneStyles[tone])}
          aria-hidden="true"
        />
      )}
      <span
        className={clsx('relative inline-block rounded-full w-full h-full', toneStyles[tone])}
        aria-hidden={label ? undefined : true}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
