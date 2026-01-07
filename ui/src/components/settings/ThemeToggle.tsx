// ===========================================
// GNS BROWSER - THEME TOGGLE COMPONENT
// ===========================================

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_KEY = 'gns_theme';

type Theme = 'light' | 'dark';

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(THEME_KEY) as Theme;
    if (stored) return stored;
    // Default to dark theme
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return [theme, setThemeState];
}

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <div className="bg-surface rounded-xl p-4 border border-border transition-colors duration-300">
      <div className="flex items-center gap-3 mb-4">
        {isDark ? (
          <Moon size={24} className="text-amber-400" />
        ) : (
          <Sun size={24} className="text-orange-400" />
        )}
        <span className="text-text-primary font-semibold tracking-wider text-sm">APPEARANCE</span>
      </div>

      <div className="flex gap-3">
        {/* Light Mode */}
        <button
          onClick={() => onThemeChange('light')}
          className={`flex-1 py-4 rounded-xl border-2 transition-all ${!isDark
            ? 'bg-green-500/15 border-green-500'
            : 'bg-transparent border-border hover:border-text-muted'
            }`}
        >
          <div className="flex flex-col items-center gap-2">
            <Sun
              size={32}
              className={!isDark ? 'text-green-500' : 'text-text-muted'}
            />
            <span
              className={`font-medium ${!isDark ? 'text-green-500' : 'text-text-muted'
                }`}
            >
              Light
            </span>
          </div>
        </button>

        {/* Dark Mode */}
        <button
          onClick={() => onThemeChange('dark')}
          className={`flex-1 py-4 rounded-xl border-2 transition-all ${isDark
            ? 'bg-green-500/15 border-green-500'
            : 'bg-transparent border-border hover:border-text-muted'
            }`}
        >
          <div className="flex flex-col items-center gap-2">
            <Moon
              size={32}
              className={isDark ? 'text-green-500' : 'text-text-muted'}
            />
            <span
              className={`font-medium ${isDark ? 'text-green-500' : 'text-text-muted'
                }`}
            >
              Dark
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

export default ThemeToggle;
