import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { loadSettings, saveSettings } from '../utils/settingsStorage';
import i18n from '../utils/i18n';
import * as Localization from 'expo-localization';

// Helper to get device's preferred date format based on region
const getDeviceDateFormat = (): 'mm-dd-yyyy' | 'dd-mm-yyyy' => {
  const locale = Localization.getLocales()[0];
  // US & Canada are primary regions using MM-DD-YYYY
  if (locale?.regionCode === 'US' || locale?.regionCode === 'CA') {
    return 'mm-dd-yyyy';
  }
  // Default to DD-MM-YYYY for most other regions
  return 'dd-mm-yyyy';
};


// 1) Create the type for your context values:
type SettingsContextType = {
  language: string;
  setLanguage: (lang: string) => void;
  dateFormat: string;
  setDateFormat: (fmt: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
};

// 2) Declare the actual context:
const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('dd-mm-yyyy');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load settings on mount
  useEffect(() => {
    const initializeSettings = async () => {
      const savedSettings = await loadSettings();
      const deviceDateFormat = getDeviceDateFormat();

      if (savedSettings) {
        setLanguage(savedSettings.language || 'en');
        setDateFormat(savedSettings.dateFormat || deviceDateFormat);
        setTheme(savedSettings.theme || 'light');

      } else {
        // Use app defaults instead of device settings
        // const fallbackLng = 'en';
        // const defaultLocale =
        //   Localization.getLocales()[0]?.languageCode || fallbackLng;
        // setLanguage(defaultLocale);
        // setDateFormat(deviceDateFormat);
        
        // Keep app defaults: language='en', theme='light', dateFormat uses device preference
        setDateFormat(deviceDateFormat);
      }
      setIsInitialized(true);
    };
    initializeSettings();
  }, []);

  // Keep i18n in sync with context
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  // Save settings only after initial load
  useEffect(() => {
    if (!isInitialized) return;
    const persistSettings = async () => {
      await saveSettings({
        language,
        dateFormat,
        theme,
      });
    };
    persistSettings();
  }, [
    language,
    dateFormat,
    theme,
    isInitialized,
  ]);

  return (
    <SettingsContext.Provider
      value={{
        language,
        setLanguage,
        dateFormat,
        setDateFormat,
        theme,
        setTheme,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// Export a custom hook so consumers can read from our SettingsContext
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
