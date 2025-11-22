import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('dark'); // 'dark', 'light', 'cosmo', 'monokai'

  useEffect(() => {
    // Update CSS variables based on theme
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.style.setProperty('--bg-main', '#050505');
      root.style.setProperty('--bg-panel', 'rgba(10, 10, 10, 0.6)');
      root.style.setProperty('--text-main', '#e5e5e5');
      root.style.setProperty('--text-muted', '#71717a');
      root.style.setProperty('--accent-primary', '#ffffff');
      root.style.setProperty('--accent-secondary', '#000000');
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--chart-color', '#ffffff');
    } else if (theme === 'light') {
      root.style.setProperty('--bg-main', '#f4f4f5');
      root.style.setProperty('--bg-panel', 'rgba(255, 255, 255, 0.8)');
      root.style.setProperty('--text-main', '#18181b');
      root.style.setProperty('--text-muted', '#71717a');
      root.style.setProperty('--accent-primary', '#000000');
      root.style.setProperty('--accent-secondary', '#ffffff');
      root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.08)');
      root.style.setProperty('--chart-color', '#000000');
    } else if (theme === 'cosmo') {
      root.style.setProperty('--bg-main', '#0a0a1a');
      root.style.setProperty('--bg-panel', 'rgba(19, 19, 43, 0.6)');
      root.style.setProperty('--text-main', '#e0e7ff');
      root.style.setProperty('--text-muted', '#94a3b8');
      root.style.setProperty('--accent-primary', '#00f3ff');
      root.style.setProperty('--accent-secondary', '#1e1b4b');
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--chart-color', '#00f3ff');
    } else if (theme === 'monokai') {
      root.style.setProperty('--bg-main', '#272822');
      root.style.setProperty('--bg-panel', 'rgba(39, 40, 34, 0.8)');
      root.style.setProperty('--text-main', '#f8f8f2');
      root.style.setProperty('--text-muted', '#75715e');
      root.style.setProperty('--accent-primary', '#fd971f'); // Orange
      root.style.setProperty('--accent-secondary', '#272822');
      root.style.setProperty('--border-color', 'rgba(248, 248, 242, 0.1)');
      root.style.setProperty('--chart-color', '#a6e22e'); // Green
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
