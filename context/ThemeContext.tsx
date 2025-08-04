import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Appearance } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

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
    // Add other colors as needed
  },
};

// Context for theme management
const ThemeContext = createContext({
  theme: CustomLightTheme, // Default to your custom light theme
  toggleTheme: () => {},
});

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState(CustomLightTheme);

  const themeFilePath = `${FileSystem.documentDirectory}theme.json`;

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await FileSystem.readAsStringAsync(themeFilePath);
        setTheme(storedTheme === 'dark' ? CustomDarkTheme : CustomLightTheme);
      } catch {
        const colorScheme = Appearance.getColorScheme();
        setTheme(colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === CustomLightTheme ? CustomDarkTheme : CustomLightTheme;
    setTheme(newTheme);
    await FileSystem.writeAsStringAsync(themeFilePath, theme === CustomLightTheme ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);