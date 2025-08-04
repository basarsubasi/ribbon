import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { SQLiteProvider } from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import Home from './screens/Home';
import Library from './screens/library/Library';
import AddBook from './screens/library/AddBook';
import BookDetails from './screens/library/BookDetails';
import EditBook from './screens/library/EditBook';
import ScanBarcode from './screens/library/ScanBarcode';
import SearchBook from './screens/library/SearchBook';

import PageLogs from './screens/page_logs/Calendar';
import LogPages from './screens/page_logs/LogPages';
import LogDetails from './screens/page_logs/LogDetails';
import EditLog from './screens/page_logs/EditLog';
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
      <LibraryStack.Screen name="BookDetails" component={BookDetails} options={{ headerShown: false }} />
      <LibraryStack.Screen name="EditBook" component={EditBook} options={{ headerShown: false }} />
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
      <PageLogsStack.Screen name="PageLogs" component={PageLogs} options={{ headerShown: false }} />
      <PageLogsStack.Screen name="LogPages" component={LogPages} options={{ headerShown: false }} />
      <PageLogsStack.Screen name="LogDetails" component={LogDetails} options={{ headerShown: false }} />
      <PageLogsStack.Screen name="EditLog" component={EditLog} options={{ headerShown: false }} />
    </PageLogsStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{
        headerShown: false, // Disable headers for all screens in this stack
      }}>
      <Tab.Screen name="Home" component={Home} options={{ headerShown: false }} />
      <Tab.Screen name="LibraryStack" component={LibraryStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="PageLogsStack" component={PageLogsStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Settings" component={Settings} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

const ThemeAwareStatusBar = () => {
  const { theme } = useTheme();
  return <StatusBar style={theme.type === 'dark' ? 'light' : 'dark'} />;
};

const AppContent = () => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.background }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SQLiteProvider databaseName="RibbonDB.db" useSuspense>
          <NavigationContainer>
            <ThemeAwareStatusBar />
            <TabNavigator />
          </NavigationContainer>
        </SQLiteProvider>
      </GestureHandlerRootView>
    </View>
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