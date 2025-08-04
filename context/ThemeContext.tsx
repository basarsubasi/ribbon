import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Appearance } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

// Context for theme management
const ThemeContext = createContext({
  theme: MD3LightTheme, // Default theme
  toggleTheme: () => {}, // Default placeholder function
});

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState(MD3LightTheme);

  const themeFilePath = `${FileSystem.documentDirectory}theme.json`;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await FileSystem.readAsStringAsync(themeFilePath);
        setTheme(storedTheme === 'dark' ? MD3DarkTheme : MD3LightTheme);
      } catch {
        const colorScheme = Appearance.getColorScheme();
        setTheme(colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === MD3LightTheme ? MD3DarkTheme : MD3LightTheme;
    setTheme(newTheme);
    await FileSystem.writeAsStringAsync(themeFilePath, theme === MD3LightTheme ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);