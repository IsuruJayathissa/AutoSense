import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NotificationService from './src/services/NotificationService';

// Suppress dev-mode red screens for native modules that aren't bundled into
// Expo Go (expo-print, expo-sharing). ReportService catches these errors and
// falls back to HTML output + RN Share — the app keeps working — but Metro's
// guardedLoadModule still reports the load failure to LogBox. These ignores
// keep the dev console clean. For full PDF support, run: npx expo run:android
LogBox.ignoreLogs([
  /Cannot find native module 'ExpoPrint'/,
  /Cannot find native module 'ExpoSharing'/,
  /Cannot find native module 'ExponentPrint'/,
]);

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