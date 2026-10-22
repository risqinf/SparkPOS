/**
 * SparkPOS Theme Management Service
 * Supports 'light' | 'dark' | 'system' with automatic system preference detection.
 * Persists user preference in localStorage and updates document.documentElement class.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'sparkpos_theme_mode';

type ThemeChangeListener = (mode: ThemeMode, isDark: boolean) => void;
const listeners: ThemeChangeListener[] = [];

/**
 * Get current saved theme preference ('system' | 'light' | 'dark')
 */
export function getSavedTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'system';
}

/**
 * Determine if dark mode is currently active (evaluating system setting if 'system')
 */
export function isDarkModeActive(): boolean {
  const mode = getSavedTheme();
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply theme class to <html> element
 */
export function applyTheme(mode?: ThemeMode) {
  const currentMode = mode || getSavedTheme();
  const root = document.documentElement;
  const isDark =
    currentMode === 'dark' ||
    (currentMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }

  // Notify all active listeners
  listeners.forEach((listener) => listener(currentMode, isDark));
}

/**
 * Set and persist theme mode
 */
export function setTheme(mode: ThemeMode) {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  applyTheme(mode);
}

/**
 * Cycle through: system -> light -> dark -> system
 */
export function cycleTheme(): ThemeMode {
  const current = getSavedTheme();
  let next: ThemeMode = 'system';
  if (current === 'system') next = 'light';
  else if (current === 'light') next = 'dark';
  else next = 'system';

  setTheme(next);
  return next;
}

/**
 * Subscribe to theme changes
 */
export function onThemeChange(listener: ThemeChangeListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

/**
 * Initialize listener for OS system theme changes
 */
export function initThemeListener() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getSavedTheme() === 'system') {
        applyTheme('system');
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    } else {
      // Fallback for older browsers
      (mediaQuery as any).addListener?.(handler);
    }
  }
}

// Auto-run listener upon module load
initThemeListener();

