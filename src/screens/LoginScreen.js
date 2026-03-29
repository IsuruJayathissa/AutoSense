import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore';

export default function LoginScreen({ navigation }) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateVehicleNumber = (number) => {
    const regex = /^[A-Z]{2,3}-\d{4}$/;
    return regex.test(number.toUpperCase());
  };

  const handleLogin = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert('Required', 'Please enter your vehicle number');
      return;
    }
    if (!validateVehicleNumber(vehicleNumber)) {
      Alert.alert('Invalid Format', 'Vehicle number must be in the format: ABC-1234');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const vehiclesRef = collection(db, 'vehicles');
      const q = query(
        vehiclesRef,
        where('vehicleNumber', '==', vehicleNumber.toUpperCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert(
          'Not Registered',
          'This vehicle number is not registered. Please register first.'
        );
        return;
      }

      const vehicleDoc = querySnapshot.docs[0];
      const vehicleData = vehicleDoc.data();

      if (vehicleData.password !== password) {
        Alert.alert('Incorrect Password', 'The password you entered is incorrect.');
        return;
      }

      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;

      await setDoc(doc(db, 'userVehicles', userId), {
        vehicleId: vehicleData.vehicleId,
        vehicleNumber: vehicleData.vehicleNumber,
      });

    } catch (error) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>
          <Text style={styles.appNameDark}>Auto</Text>
          <Text style={styles.appNameRed}>Sense</Text>
        </Text>
        <Text style={styles.appTagline}>Smart Vehicle Diagnostics</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        {/* Tabs */}
        <View style={styles.tabRow}>
          <View style={styles.tabActive}>
            <Text style={styles.tabActiveText}>Sign In</Text>
          </View>
          <TouchableOpacity
            style={styles.tabInactive}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.tabInactiveText}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicle Number */}
        <Text style={styles.label}>Vehicle Number</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🪪</Text>
          <TextInput
            style={styles.input}
            placeholder="CAD-3379"
            placeholderTextColor="#aaa"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <Text style={styles.hint}>Format: ABC-1234</Text>

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login  →</Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            👋  Login using your vehicle number and password.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EEEE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  appNameDark: {
    color: '#1F2937',
  },
  appNameRed: {
    color: '#8B0000',
  },
  appTagline: {
    fontSize: 15,
    color: '#555',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tabActive: {
    flex: 1,
    backgroundColor: '#8B0000',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActiveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  tabInactive: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabInactiveText: {
    color: '#6B7280',
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
    marginLeft: 2,
  },
  button: {
    backgroundColor: '#8B0000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  infoBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 12,
  },
  infoText: {
    color: '#8B0000',
    fontSize: 13,
    textAlign: 'center',
  },
});
