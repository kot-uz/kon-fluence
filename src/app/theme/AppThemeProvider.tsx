import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';

const STORAGE_KEY = 'docs-dark-mode';

interface ThemeModeContextValue {
  isDark: boolean;
  toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({ isDark: false, toggle: () => {} });

export const useThemeMode = () => useContext(ThemeModeContext);

const readIsDark = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved === 'true';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

/**
 * Тема MUI + класс `dark` на <html> для Tailwind: модуль документации использует
 * и то, и другое (sx/styled и классы dark:bg-dark), поэтому переключать нужно синхронно.
 *
 * Типографика задана в rem и рассчитана на корень 10px (см. src/styles/app-base.css).
 */
const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark] = useState(readIsDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEY, String(isDark));
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((value) => !value), []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: isDark ? 'dark' : 'light',
          primary: { main: '#2a3eb1' },
          secondary: { main: '#0891b2' },
          background: isDark
            ? { default: '#16151C', paper: '#1E1D26' }
            : { default: '#F6F7F9', paper: '#FFFFFF' },
        },
        typography: {
          fontFamily: ['Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'].join(','),
          fontSize: 14,
          htmlFontSize: 10,
        },
        shape: { borderRadius: 8 },
        components: {
          MuiButton: { defaultProps: { disableElevation: true } },
          MuiTooltip: { defaultProps: { enterDelay: 400 } },
        },
      }),
    [isDark]
  );

  const value = useMemo(() => ({ isDark, toggle }), [isDark, toggle]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export default AppThemeProvider;
