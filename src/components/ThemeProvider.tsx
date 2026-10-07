'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'riftbound-theme';

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

const ThemeContext = createContext<{
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const pref = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    setPreferenceState(pref);
    applyTheme(pref);
    setResolved(pref === 'dark' || (pref === 'system' && systemDark()) ? 'dark' : 'light');

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as ThemePreference) || 'system';
      if (current === 'system') {
        applyTheme('system');
        setResolved(systemDark() ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolved,
      setPreference: (pref: ThemePreference) => {
        localStorage.setItem(STORAGE_KEY, pref);
        setPreferenceState(pref);
        applyTheme(pref);
        setResolved(pref === 'dark' || (pref === 'system' && systemDark()) ? 'dark' : 'light');
      },
      toggle: () => {
        const next = resolved === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        setPreferenceState(next);
        applyTheme(next);
        setResolved(next);
      },
    }),
    [preference, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
