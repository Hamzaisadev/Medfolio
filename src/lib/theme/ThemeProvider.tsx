/**
 * Theme selection: light, dark, or follow the operating system.
 *
 * The resolved theme is applied by toggling `.dark` on <html>, which is what the
 * `@custom-variant dark` rule in theme.css keys off. All colour decisions live in
 * CSS variables, so switching themes never re-renders a component tree — it just
 * swaps the values behind the semantic tokens.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Shared with the pre-hydration script in index.html — keep the two in step. */
export const THEME_STORAGE_KEY = 'medfolio_theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  /** What the user chose, including 'system'. */
  preference: ThemePreference;
  /** What is actually on screen right now. */
  theme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** Flips between light and dark, resolving 'system' to its current value first. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode or blocked storage: fall through to following the system.
  }
  return 'system';
}

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/**
 * Applies the theme to the document.
 *
 * Also updates `<meta name="theme-color">`, which colours the browser chrome and
 * the PWA status bar — leaving it on the light brand colour makes a dark-themed
 * installed app look broken at the top edge of the screen.
 */
function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#2b2724' : '#0d9488');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolve(readStoredPreference()));

  // Keep the DOM in step with the resolved theme.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS while the preference is 'system'. Without this, someone who
  // never opened Settings would be stuck on whatever the OS reported at load.
  useEffect(() => {
    if (preference !== 'system') {
      setTheme(preference);
      return;
    }

    const media = window.matchMedia(DARK_QUERY);
    const sync = () => setTheme(media.matches ? 'dark' : 'light');
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference is not persisted, but the session still honours it.
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolve(readStoredPreference()) === 'dark' ? 'light' : 'dark');
  }, [setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return context;
}
