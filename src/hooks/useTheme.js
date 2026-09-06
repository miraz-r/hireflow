import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('hireflow-theme');
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
        document.documentElement.setAttribute('data-theme', saved);
        return;
      }
    } catch (e) {
      // ignore storage errors
    }
    setTheme('light');
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('hireflow-theme', newTheme);
    } catch (e) {
      // ignore storage errors
    }
  };

  return { theme, updateTheme };
}
