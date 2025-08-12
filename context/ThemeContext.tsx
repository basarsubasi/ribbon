import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Appearance } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { useSettings } from './SettingsContext';

// Define your custom light theme
const CustomLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#80C9A0',
    onPrimary: '#212121',
    primaryContainer: '#d1e7dd',
    onPrimaryContainer: '#212121',
    background: '#FFFFFF',
    onBackground: '#424242',
    surface: '#FFFFFF',
    onSurface: '#424242',
    secondary: '#a9d6e5',
    onSecondary: '#212121',
    calendarBackground: '#FFFFFF',
    calendarBorder: '#FFFFFF',
    // Add other colors as needed, e.g., tertiary, error, etc.
  },
};

// Define your custom dark theme
const CustomDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#50b2a0',
    onPrimary: '#FFFFFF',
    primaryContainer: '#2c7a72',
    onPrimaryContainer: '#FFFFFF',
    background: '#121212',
    onBackground: '#E0E0E0',
    surface: '#1E1E1E',
    onSurface: '#E0E0E0',
    secondary: '#6b9eaf',
    onSecondary: '#FFFFFF',
    calendarBackground: '#212121ff',
    calendarBorder: '#121212',
    // Add other colors as needed
  },
};

// Context for theme management (driven by SettingsContext.theme)
const ThemeContext = createContext({
  theme: CustomLightTheme, // full Paper theme object
  mode: 'light' as 'light' | 'dark',
  setMode: (_m: 'light' | 'dark') => {},
  toggleTheme: () => {},
});

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const { theme: settingsTheme } = useSettings(); // 'light' | 'dark' from SettingsContext
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [theme, setTheme] = useState(CustomLightTheme);

  const themeFilePath = `${FileSystem.documentDirectory}theme.json`;

  // Initialize based on stored file or settings (priority: stored, then settings, then system)
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await FileSystem.readAsStringAsync(themeFilePath);
        const initialMode = stored === 'dark' ? 'dark' : 'light';
        setMode(initialMode);
        setTheme(initialMode === 'dark' ? CustomDarkTheme : CustomLightTheme);
      } catch {
        const initialMode = settingsTheme || (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
        setMode(initialMode);
        setTheme(initialMode === 'dark' ? CustomDarkTheme : CustomLightTheme);
      }
    };
    loadTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to SettingsContext theme changes
  useEffect(() => {
    if (settingsTheme && settingsTheme !== mode) {
      setMode(settingsTheme);
      setTheme(settingsTheme === 'dark' ? CustomDarkTheme : CustomLightTheme);
      FileSystem.writeAsStringAsync(themeFilePath, settingsTheme).catch(() => {});
    }
  }, [settingsTheme, mode]);

  const setModeExplicit = async (m: 'light' | 'dark') => {
    setMode(m);
    setTheme(m === 'dark' ? CustomDarkTheme : CustomLightTheme);
    try { await FileSystem.writeAsStringAsync(themeFilePath, m); } catch {}
  };

  const toggleTheme = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setModeExplicit(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode: setModeExplicit, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);