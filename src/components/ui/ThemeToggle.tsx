import { clsx } from 'clsx';
import { useTheme, type ThemePreference } from '../../lib/theme/ThemeProvider';
import { SunIcon, MoonIcon, MonitorIcon } from './icons';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof SunIcon }> = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
];

export interface ThemeToggleProps {
  className?: string;
}

/**
 * Three-way theme control.
 *
 * 'System' is a real option rather than just the initial default: someone whose
 * phone switches to dark at sunset should not have to come back here to match it.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 p-1 rounded-[var(--radius-lg)]',
        'border border-line bg-surface-sunken',
        className
      )}
      role="radiogroup"
      aria-label="Colour theme"
    >
      {OPTIONS.map(({ value, label, icon: IconComponent }) => {
        const isActive = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setPreference(value)}
            className={clsx(
              'inline-flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-md)]',
              'text-xs font-semibold transition-[background-color,color] duration-[var(--duration-fast)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              isActive
                ? 'bg-surface-raised text-content shadow-card'
                : 'text-content-muted hover:text-content'
            )}
          >
            <IconComponent size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
