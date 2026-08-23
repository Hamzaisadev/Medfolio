interface LogoProps {
  className?: string;
  variant?: 'full' | 'mark';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * The mark keeps its brand teal in both themes — a logo that changes colour
 * stops being a logo. Only the wordmark's accent syllable is themed, because
 * brand-600 on a dark surface falls below the contrast floor.
 */
export function Logo({ className = '', variant = 'full', size = 'md' }: LogoProps) {
  const sizeMap = {
    sm: { height: 28, markWidth: 28, fullWidth: 120 },
    md: { height: 36, markWidth: 36, fullWidth: 150 },
    lg: { height: 48, markWidth: 48, fullWidth: 190 },
  };

  const { height, markWidth, fullWidth } = sizeMap[size];

  if (variant === 'mark') {
    return (
      <svg
        className={className}
        width={markWidth}
        height={height}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Medfolio"
      >
        <defs>
          <linearGradient id="logo-bg-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-brand-700)" />
          </linearGradient>
          <linearGradient id="logo-dot-grad" x1="20" y1="20" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--color-brand-300)" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#logo-bg-grad)" />
        <path
          d="M12 10C12 7.79086 13.7909 6 16 6H32C34.2091 6 36 7.79086 36 10V38C36 40.2091 34.2091 42 32 42H16C13.7909 42 12 40.2091 12 38V10Z"
          fill="#ffffff"
          fillOpacity="0.12"
        />
        <path d="M24 14V34M14 24H34" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="2.5" fill="url(#logo-dot-grad)" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width={fullWidth}
      height={height}
      viewBox="0 0 200 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Medfolio"
    >
      <defs>
        <linearGradient id="full-bg-grad" x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-brand-500)" />
          <stop offset="100%" stopColor="var(--color-brand-700)" />
        </linearGradient>
        <linearGradient id="full-dot-grad" x1="18" y1="18" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-brand-300)" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <g transform="translate(2, 2)">
        <rect x="2" y="2" width="40" height="40" rx="12" fill="url(#full-bg-grad)" />
        <path
          d="M10 8C10 5.79086 11.7909 4 14 4H30C32.2091 4 34 5.79086 34 8V36C34 38.2091 32.2091 40 30 40H14C11.7909 40 10 38.2091 10 36V8Z"
          fill="#ffffff"
          fillOpacity="0.12"
        />
        <path d="M22 13V31M13 22H31" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
        <circle cx="22" cy="22" r="2.2" fill="url(#full-dot-grad)" />
      </g>
      <text
        x="56"
        y="31"
        fontFamily="'Inter Variable', 'Inter', system-ui, sans-serif"
        fontSize="23"
        fontWeight="700"
        fill="currentColor"
        letterSpacing="-0.03em"
      >
        Med<tspan fill="var(--accent)">folio</tspan>
      </text>
    </svg>
  );
}
