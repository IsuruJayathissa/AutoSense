import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { collection, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../config/firebase';

export default function VehicleAuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [vehicleData, setVehicleData] = useState({
    vehicleNumber: '',
    brand: '',
    model: '',
    year: '',
    engineType: 'Petrol',
  });

  const brands = ['Toyota', 'Honda', 'Nissan', 'Suzuki', 'Mitsubishi', 'Other'];
  const engineTypes = ['Petrol', 'Diesel', 'Hybrid', 'Electric'];

  // Validate vehicle number format
  const validateVehicleNumber = (number) => {
    const regex = /^[A-Z]{2,3}-\d{4}$/;
    return regex.test(number.toUpperCase());
  };

  // Handle Login
  const handleLogin = async () => {
    if (!vehicleData.vehicleNumber || !vehicleData.model || !vehicleData.year) {
      Alert.alert('Error', 'Please fill all fields to login');
      return;
    }

    if (!validateVehicleNumber(vehicleData.vehicleNumber)) {
      Alert.alert('Invalid Format', 'Vehicle number should be: ABC-1234 or AB-1234');
      return;
    }

    setLoading(true);
    try {
      // Search for vehicle in Firestore
      const vehiclesRef = collection(db, 'vehicles');
      const q = query(
        vehiclesRef,
        where('vehicleNumber', '==', vehicleData.vehicleNumber.toUpperCase()),
        where('model', '==', vehicleData.model),
        where('year', '==', vehicleData.year)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        Alert.alert('Not Found', 'Vehicle not registered. Please register first.');
        setIsLogin(false); // Switch to register mode
        return;
      }

      // Vehicle found - Login
      const vehicleDoc = querySnapshot.docs[0];
      const vehicleInfo = vehicleDoc.data();

      // Sign in anonymously (or use existing auth)
      await signInAnonymously(auth);
      
      // Store vehicle ID in auth user
      const userId = auth.currentUser.uid;
      await setDoc(doc(db, 'userVehicles', userId), {
        vehicleId: vehicleDoc.id,
        vehicleNumber: vehicleInfo.vehicleNumber,
      });

      Alert.alert('Success', 'Login successful!', [
        { text: 'OK', onPress: () => navigation.replace('Home') }
      ]);

    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async () => {
    // Validation
    if (!vehicleData.vehicleNumber || !vehicleData.brand || 
        !vehicleData.model || !vehicleData.year) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (!validateVehicleNumber(vehicleData.vehicleNumber)) {
      Alert.alert('Invalid Format', 'Vehicle number should be: ABC-1234 or AB-1234');
      return;
    }

    const currentYear = new Date().getFullYear();
    const yearNum = parseInt(vehicleData.year);
    if (yearNum < 1980 || yearNum > currentYear) {
      Alert.alert('Invalid Year', `Year should be between 1980 and ${currentYear}`);
      return;
    }

    setLoading(true);
    try {
      // Check if vehicle already exists
      const vehiclesRef = collection(db, 'vehicles');
      const q = query(
        vehiclesRef,
        where('vehicleNumber', '==', vehicleData.vehicleNumber.toUpperCase())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        Alert.alert('Already Registered', 
          'This vehicle is already registered. Please use login.');
        setIsLogin(true);
        return;
      }

      // Sign in anonymously
      await signInAnonymously(auth);
      const userId = auth.currentUser.uid;

      // Create unique vehicle ID
      const vehicleId = `VEH_${Date.now()}`;

      // Save vehicle data
      await setDoc(doc(db, 'vehicles', vehicleId), {
        ...vehicleData,
        vehicleNumber: vehicleData.vehicleNumber.toUpperCase(),
        vehicleId: vehicleId,
        registeredAt: new Date().toISOString(),
        userId: userId,
      });

      // Link user to vehicle
      await setDoc(doc(db, 'userVehicles', userId), {
        vehicleId: vehicleId,
        vehicleNumber: vehicleData.vehicleNumber.toUpperCase(),
      });

      Alert.alert('Success', 'Vehicle registered successfully!', [
        { text: 'OK', onPress: () => navigation.replace('Home') }
      ]);

    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🚗</Text>
        <Text style={styles.headerTitle}>Smart Vehicle Diagnostic</Text>
        <Text style={styles.headerSubtitle}>
          {isLogin ? 'Login with your vehicle' : 'Register your vehicle'}
        </Text>
      </View>

      {/* Toggle Login/Register */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
          onPress={() => setIsLogin(true)}
        >
          <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>
            Login
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
          onPress={() => setIsLogin(false)}
        >
          <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>
            Register
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.form}>
        {/* Vehicle Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Vehicle Number <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="ABC-1234 or AB-1234"
            value={vehicleData.vehicleNumber}
            onChangeText={(text) => 
              setVehicleData({...vehicleData, vehicleNumber: text.toUpperCase()})
            }
            autoCapitalize="characters"
            maxLength={8}
            editable={!loading}
          />
          <Text style={styles.hint}>Format: ABC-1234</Text>
        </View>

        {/* Brand (Register only) */}
        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Brand <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.chipContainer}>
              {brands.map((brand) => (
                <TouchableOpacity
                  key={brand}
                  style={[
                    styles.chip,
                    vehicleData.brand === brand && styles.chipSelected
                  ]}
                  onPress={() => setVehicleData({...vehicleData, brand})}
                  disabled={loading}
                >
                  <Text style={[
                    styles.chipText,
                    vehicleData.brand === brand && styles.chipTextSelected
                  ]}>
                    {brand}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Model */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Model <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Vezel, Hiace, Aqua"
            value={vehicleData.model}
            onChangeText={(text) => 
              setVehicleData({...vehicleData, model: text})
            }
            editable={!loading}
          />
        </View>

        {/* Year */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Year <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2014"
            value={vehicleData.year}
            onChangeText={(text) => 
              setVehicleData({...vehicleData, year: text})
            }
            keyboardType="numeric"
            maxLength={4}
            editable={!loading}
          />
        </View>

        {/* Engine Type (Register only) */}
        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Engine Type <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.chipContainer}>
              {engineTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    vehicleData.engineType === type && styles.chipSelected
                  ]}
                  onPress={() => 
                    setVehicleData({...vehicleData, engineType: type})
                  }
                  disabled={loading}
                >
                  <Text style={[
                    styles.chipText,
                    vehicleData.engineType === type && styles.chipTextSelected
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={isLogin ? handleLogin : handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isLogin ? 'Login' : 'Register Vehicle'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {isLogin 
              ? '🔐 Login using your vehicle number, model and year'
              : '✨ First time? Register your vehicle to get started'}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Smart Vehicle Diagnostic v1.0.0{'\n'}
        Secure Vehicle-Based Authentication
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#007AFF',
    padding: 30,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerIcon: { fontSize: 60, marginBottom: 10 },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e0e0',
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  form: { padding: 20, paddingTop: 0 },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: { color: '#FF3B30' },
  input: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    color: '#1976D2',
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 30,
    marginBottom: 30,
    lineHeight: 18,
  },
});