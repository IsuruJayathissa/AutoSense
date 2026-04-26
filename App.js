import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NotificationService from './src/services/NotificationService';

SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    // Request notification permissions and hide splash in parallel
    NotificationService.requestPermissions().catch(() => {});
    setTimeout(async () => {
      await SplashScreen.hideAsync();
    }, 2000);
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
    </SafeAreaProvider>
  );
}