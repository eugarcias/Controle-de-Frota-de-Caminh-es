'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vsm.theme') as Theme | null;
      if (saved === 'dark' || saved === 'light') {
        setThemeState(saved);
        if (saved === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setThemeState('dark');
        document.documentElement.classList.add('dark');
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('vsm.theme', t);
    } catch {
      // ignore
    }
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div className={mounted ? '' : 'contents'}>{children}</div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
