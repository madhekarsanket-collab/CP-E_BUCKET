import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../hooks';

/** Accessible on/off switch for dark mode. */
export default function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      className="theme-switch"
      onClick={toggle}
    >
      <Sun className="theme-switch-sun" size={14} aria-hidden="true" />
      <Moon className="theme-switch-moon" size={14} aria-hidden="true" />
      <span className="theme-switch-thumb" aria-hidden="true">
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
}
