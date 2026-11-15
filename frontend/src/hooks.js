import { useEffect, useState } from 'react';

const THEME_KEY = 'ebucket_theme';

/** Light/dark theme. theme-init.js already set data-theme before first paint; this keeps it in sync. */
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#17100B' : '#F2A007');
  }, [theme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Preference just won't persist.
    }
  };
  return [theme, toggle];
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | E-Bucket` : 'E-Bucket | The whole bazaar, one cart';
  }, [title]);
}

/** Wait for the user to stop typing before using a value (search boxes). */
export function useDebounced(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
