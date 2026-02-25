import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD13AEE4j2CSCEmCh6m27njljqkLmow_eg",
  authDomain: "smartvehiclediagnostic-a285a.firebaseapp.com",
  projectId: "smartvehiclediagnostic-a285a",
  storageBucket: "smartvehiclediagnostic-a285a.firebasestorage.app",
  messagingSenderId: "518989474192",
  appId: "1:518989474192:web:9252a710fbca6a8fb2eb15",
  measurementId: "G-2E91RVG4DM"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);

export { auth, db };