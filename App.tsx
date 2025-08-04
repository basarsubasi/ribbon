import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StatusBar, StyleSheet, Pressable, Text, Platform } from 'react-native'; // Import Platform
import * as FileSystem from 'expo-file-system';
import { SQLiteProvider } from 'expo-sqlite';
import { Asset } from 'expo-asset';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import Home from './screens/Home';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();
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

function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={Home} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="RibbonDB.db" useSuspense>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}