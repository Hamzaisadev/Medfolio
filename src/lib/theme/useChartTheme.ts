/**
 * Resolved colour values for chart libraries.
 *
 * Recharts takes colours as props (`stroke`, `fill`), not as classes, so it
 * cannot use the semantic Tailwind utilities the rest of the UI relies on. This
 * reads the computed value of each token off the document and re-reads it when
 * the theme changes, so charts follow light/dark like everything else instead of
 * keeping the hardcoded hex values they used to carry.
 */

import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';

export interface ChartTheme {
  axis: string;
  grid: string;
  text: string;
  accent: string;
  ok: string;
  warn: string;
  risk: string;
  info: string;
  surface: string;
  /** Categorical series colours, in the order they should be assigned. */
  series: string[];
}

/** Fallbacks used during SSR or before first paint; never user-visible for long. */
const FALLBACK: ChartTheme = {
  axis: '#a8a29e',
  grid: '#e7e5e4',
  text: '#57534e',
  accent: '#0d9488',
  ok: '#15803d',
  warn: '#b45309',
  risk: '#b91c1c',
  info: '#1d4ed8',
  surface: '#ffffff',
  series: ['#0d9488', '#1d4ed8', '#b45309', '#7c3aed', '#be123c'],
};

function readVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

function readChartTheme(): ChartTheme {
  if (typeof window === 'undefined') return FALLBACK;

  const styles = getComputedStyle(document.documentElement);
  const accent = readVar(styles, '--accent', FALLBACK.accent);
  const info = readVar(styles, '--info-text', FALLBACK.info);
  const warn = readVar(styles, '--warn-text', FALLBACK.warn);
  const risk = readVar(styles, '--risk-text', FALLBACK.risk);

  return {
    axis: readVar(styles, '--line-strong', FALLBACK.axis),
    grid: readVar(styles, '--line', FALLBACK.grid),
    text: readVar(styles, '--content-muted', FALLBACK.text),
    accent,
    ok: readVar(styles, '--ok-text', FALLBACK.ok),
    warn,
    risk,
    info,
    surface: readVar(styles, '--surface-raised', FALLBACK.surface),
    series: [accent, info, warn, readVar(styles, '--slot-evening-text', '#7c3aed'), risk],
  };
}

export function useChartTheme(): ChartTheme {
  const { theme } = useTheme();
  const [chartTheme, setChartTheme] = useState<ChartTheme>(readChartTheme);

  useEffect(() => {
    // The class swap and the CSS variable recalculation happen in the same frame,
    // so read on the next one to get the values that are actually painted.
    const frame = requestAnimationFrame(() => setChartTheme(readChartTheme()));
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  return chartTheme;
}
