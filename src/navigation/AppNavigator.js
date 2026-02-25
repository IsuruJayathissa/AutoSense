import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

// Auth Screen
import VehicleAuthScreen from '../screens/VehicleAuthScreen';

// App Screens
import HomeScreen from '../screens/HomeScreen';
import OBDConnectionScreen from '../screens/OBDConnectionScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FaultCodesScreen from '../screens/FaultCodesScreen';
import EngineHealthScreen from '../screens/EngineHealthScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="OBDConnection" component={OBDConnectionScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="FaultCodes" component={FaultCodesScreen} />
            <Stack.Screen name="EngineHealth" component={EngineHealthScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <Stack.Screen name="VehicleAuth" component={VehicleAuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}