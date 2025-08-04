import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app_settings';

type AppSettings = {
  theme: 'light' | 'dark';
  language: string;
  dateFormat: string;
};

export const saveSettings = async (settings: AppSettings) => {
  try {
    const jsonValue = JSON.stringify(settings);
    await AsyncStorage.setItem(SETTINGS_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to save settings.", e);
  }
};

export const loadSettings = async (): Promise<AppSettings | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(SETTINGS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Failed to load settings.", e);
    return null;
  }
};
