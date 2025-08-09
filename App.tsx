import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Pressable, StyleSheet, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { PaperProvider } from 'react-native-paper';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

// Initialize i18n
import './utils/i18n';

// Import test data function
import { insertTestData } from './utils/insertTestData';

// Initialize i18n
import './utils/i18n';

import Home from './screens/Home';
import Library from './screens/library/Library';
import AddBook from './screens/library/AddBook';
import LibraryBookDetails from './screens/library/LibraryBookDetails';
import OpenLibraryBookDetails from './screens/library/OpenLibraryBookDetails';
import ScanBarcode from './screens/library/ScanBarcode';
import SearchBook from './screens/library/SearchBook';

import Calendar from './screens/page_logs/Calendar';
import ChooseBook from './screens/page_logs/ChooseBook';
import LogPages from './screens/page_logs/LogPages';
import LogDetails from './screens/page_logs/LogDetails';
import Settings from './screens/Settings';


import { LibraryStackParamList, PageLogsStackParamList } from './utils/types';


const LibraryStack = createNativeStackNavigator<LibraryStackParamList>();
const PageLogsStack = createNativeStackNavigator<PageLogsStackParamList>();
const Tab = createBottomTabNavigator();

const loadDatabase = async () => {
  try {
    const dbName = "RibbonDB.db";
    const dbAsset = require("./assets/db/RibbonDB.db");
    const dbUri = Asset.fromModule(dbAsset).uri;
    const dbFilePath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

    const fileInfo = await FileSystem.getInfoAsync(dbFilePath);

    if (!fileInfo.exists) {
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}SQLite`,
        { intermediates: true }
      );
      console.log("Downloading database...");
      await FileSystem.downloadAsync(dbUri, dbFilePath);

    } else {
      console.log("Database already exists.");

    }
  } catch (error) {
    console.error("Error in loadDatabase:", error);
  }
};

function LibraryStackNavigator() {
  return (
    <LibraryStack.Navigator   screenOptions={{
          headerShown: false, // Disable headers for all screens in this stack
        }}>
      <LibraryStack.Screen name="Library" component={Library} options={{ headerShown: false }} />
      <LibraryStack.Screen name="AddBook" component={AddBook} options={{ headerShown: false }}   />
      <LibraryStack.Screen name="LibraryBookDetails" component={LibraryBookDetails} options={{ headerShown: false }} />
      <LibraryStack.Screen name="OpenLibraryBookDetails" component={OpenLibraryBookDetails} options={{ headerShown: false }} />
      <LibraryStack.Screen name="ScanBarcode" component={ScanBarcode} options={{ headerShown: false }} />
      <LibraryStack.Screen name="SearchBook" component={SearchBook} options={{ headerShown: false }} />
    </LibraryStack.Navigator>
  );
}

function PageLogsStackNavigator() {
  return (
    <PageLogsStack.Navigator   screenOptions={{
          headerShown: false, // Disable headers for all screens in this stack
        }}>
      <PageLogsStack.Screen name="Calendar" component={Calendar} options={{ headerShown: false }} />
      <PageLogsStack.Screen name="ChooseBook" component={ChooseBook} options={{ headerShown: false }} />
      <PageLogsStack.Screen name="LogPages" component={LogPages} options={{ headerShown: false }} />
      <PageLogsStack.Screen name="LogDetails" component={LogDetails} options={{ headerShown: false }} />
    </PageLogsStack.Navigator>
  );
}

function TabNavigator() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.onSurface,
        tabBarInactiveTintColor: theme.colors.onSurface,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          marginTop: 10,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0, },
      }}>
      <Tab.Screen
        name="Home"
        component={Home}
        options={({ navigation }) => ({
          tabBarShowLabel: false,
          tabBarButton: (props) => {
            const state = navigation.getState();
            const currentRouteName = state.routes[state.index].name;
            const isSelected = currentRouteName === "Home";
            return (
              <TabButton {...props} isSelected={isSelected}>
                <Ionicons name="home" size={24} color={theme.colors.onSurface} />
              </TabButton>
            );
          },
        })}
      />
      <Tab.Screen
        name="LibraryStack"
        component={LibraryStackNavigator}
        options={({ navigation }) => ({
          tabBarShowLabel: false,
          tabBarButton: (props) => {
            const state = navigation.getState();
            const currentRouteName = state.routes[state.index].name;
            const isSelected = currentRouteName === "LibraryStack";
            return (
              <TabButton {...props} isSelected={isSelected}>
                <FontAwesome name="book" size={24} color={theme.colors.onSurface} />
              </TabButton>
            );
          },
        })}
      />
      <Tab.Screen
       name="PageLogsStack"
       component={PageLogsStackNavigator}
       options={({ navigation }) => ({
          tabBarShowLabel: false,
          tabBarButton: (props) => {
            const state = navigation.getState();
            const currentRouteName = state.routes[state.index].name;
            const isSelected = currentRouteName === "PageLogsStack";
            return (
              <TabButton {...props} isSelected={isSelected}>
                <Ionicons name="calendar" size={24} color={theme.colors.onSurface} />
              </TabButton>
            );
          },
        })}
       />
      <Tab.Screen
       name="Settings"
       component={Settings}
       options={({ navigation }) => ({
          tabBarShowLabel: false,
          tabBarButton: (props) => {
            const state = navigation.getState();
            const currentRouteName = state.routes[state.index].name;
            const isSelected = currentRouteName === "Settings";
            return (
              <TabButton {...props} isSelected={isSelected}>
                <Ionicons name="settings-sharp" size={24} color={theme.colors.onSurface} />
              </TabButton>
            );
          },
        })}
         />
    </Tab.Navigator>
  );
}

const TabButton = (props: any) => {
  const { onPress, children, isSelected } = props;
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress} style={styles.tabButton}>
      {children}
      <View
        style={{
          height: 3,
          borderRadius: 15,
          width: 30,
                    backgroundColor: isSelected ? theme.colors.onSurface : 'transparent',
          marginTop: 5,
        }}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 1,
  },
});

const ThemeAwareStatusBar = () => {
  const { theme } = useTheme();
  return <StatusBar style={theme.dark ? 'light' : 'dark'} />;
};

const DatabaseInitializer = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const db = useSQLiteContext();

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        console.log('Initializing database with test data...');
        await insertTestData(db);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Still allow the app to continue even if test data insertion fails
        setIsInitialized(true);
      }
    };

    initializeDatabase();
  }, [db]);

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(theme.colors.background);
      NavigationBar.setButtonStyleAsync(theme.dark ? 'light' : 'dark');
    }
  }, [theme]);

  return (
    <PaperProvider theme={theme}>
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SQLiteProvider databaseName="RibbonDB.db" useSuspense>
            <DatabaseInitializer>
              <NavigationContainer>
                <ThemeAwareStatusBar />
                <TabNavigator />
              </NavigationContainer>
               </DatabaseInitializer>
          </SQLiteProvider>
        </GestureHandlerRootView>
      </View>
    </PaperProvider>
  );
};

export default function App() {
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    loadDatabase().then(() => {
      setDbLoaded(true);
    }).catch(err => {
      console.error("Failed to load database", err);
    })
  }, []);

  if (!dbLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}