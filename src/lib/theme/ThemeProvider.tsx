/**
 * Pure Light Theme Provider for Medfolio.
 *
 * Enforces the pristine, patient-first Clinical Light palette across the app.
 * Dark theme is abolished per medical design guidelines.
 */

import { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';

export type ThemePreference = 'light';
export type ResolvedTheme = 'light';

export const THEME_STORAGE_KEY = 'medfolio_theme';

interface ThemeContextValue {
  preference: 'light';
  theme: 'light';
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'light',
  theme: 'light',
  setPreference: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Ensure .dark is permanently removed from the root
    document.documentElement.classList.remove('dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', '#0d9488');
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference: 'light',
      theme: 'light',
      setPreference: () => {},
      toggle: () => {},
    }),
    []
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
