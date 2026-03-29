import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  query,
  where,
  getDocs 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

export default function VehicleAuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form data
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [password, setPassword] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [engineType, setEngineType] = useState('');

  const brands = [
    { name: 'Toyota', icon: 'car-sport' },
    { name: 'Honda', icon: 'car' },
    { name: 'Nissan', icon: 'car-outline' },
    { name: 'Suzuki', icon: 'car-sport-outline' },
    { name: 'Mitsubishi', icon: 'car' },
    { name: 'Other', icon: 'add-circle-outline' },
  ];

  const engineTypes = [
    { name: 'Petrol', icon: 'water', color: '#EF4444' },
    { name: 'Diesel', icon: 'water-outline', color: '#DC2626' },
    { name: 'Hybrid', icon: 'leaf', color: '#B91C1C' },
    { name: 'Electric', icon: 'flash', color: '#991B1B' },
  ];

  // Validate vehicle number
  const validateVehicleNumber = (number) => {
    const regex = /^[A-Z]{2,3}-\d{4}$/;
    return regex.test(number.toUpperCase());
  };

  const handleLogin = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert('Required', 'Please enter vehicle number');
      return;
    }
  
    if (!validateVehicleNumber(vehicleNumber)) {
      Alert.alert('Invalid Format', 'Vehicle number: ABC-1234');
      return;
    }
  
    if (!password.trim()) {
      Alert.alert('Required', 'Please enter password');
      return;
    }
  
    setLoading(true);
    try {
      const vehiclesRef = collection(db, 'vehicles');
      const q = query(vehiclesRef, where('vehicleNumber', '==', vehicleNumber.toUpperCase()));
      const querySnapshot = await getDocs(q);
  
      if (querySnapshot.empty) {
        Alert.alert('Not Registered', 'This vehicle is not registered. Please register first.');
        setLoading(false);
        return;
      }
  
      const vehicleDoc = querySnapshot.docs[0];
      const vehicleData = vehicleDoc.data();
  
      // Verify password
      if (vehicleData.password !== password) {
        Alert.alert('Incorrect Password', 'The password you entered is incorrect.');
        setLoading(false);
        return;
      }
  
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;
  
      await setDoc(doc(db, 'userVehicles', userId), {
        vehicleId: vehicleData.vehicleId,
        vehicleNumber: vehicleData.vehicleNumber,
      });
  
      navigation.replace('Home');
  
    } catch (error) {
      console.error('Login Error:', error);
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!vehicleNumber.trim() || !password.trim() || !brand || !model.trim() || !year.trim() || !engineType) {
      Alert.alert('Incomplete', 'Please fill all required fields');
      return;
    }

    if (!validateVehicleNumber(vehicleNumber)) {
      Alert.alert('Invalid Format', 'Use format: ABC-1234');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      const userId = userCredential.user.uid;

      const vehicleId = `VEH_${Date.now()}`;
      const vehicleData = {
        vehicleId,
        vehicleNumber: vehicleNumber.toUpperCase(),
        password,
        brand,
        model: model.trim(),
        year: year.trim(),
        engineType,
        userId,
        registeredAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'vehicles', vehicleId), vehicleData);
      await setDoc(doc(db, 'userVehicles', userId), {
        vehicleId,
        vehicleNumber: vehicleNumber.toUpperCase(),
      });

      Alert.alert('Success! 🎉', 'Vehicle registered successfully!', [
        { text: 'Continue', onPress: () => navigation.replace('Home') },
      ]);
      
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Dark Background with Red Glow */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={['#FFFFFF', '#F9FAFB', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.redGlowTop} />
        <View style={styles.redGlowBottom} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo & Title */}
            <View style={styles.headerSection}>
              <View style={styles.logoCircle}>
                <LinearGradient
                  colors={['#8B0000', '#A00000']}
                  style={styles.logoGradient}
                >
                  <Ionicons name="car-sport" size={40} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <Text style={styles.appTitle}>
                Auto<Text style={styles.appTitleRed}>Sense</Text>
              </Text>
              <Text style={styles.appSubtitle}>Smart Vehicle Diagnostics</Text>
            </View>

            {/* Dark Glass Card */}
            <View style={styles.glassCard}>
              <View style={styles.cardBorderTop} />
              
              {/* Tab Switcher */}
              <View style={styles.tabSwitcher}>
                <TouchableOpacity
                  style={[styles.tabButton, isLogin && styles.tabButtonActive]}
                  onPress={() => setIsLogin(true)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isLogin ? ['#8B0000', '#A00000'] : ['transparent', 'transparent']}
                    style={styles.tabGradient}
                  >
                    <Ionicons
                      name="log-in-outline"
                      size={20}
                      color={isLogin ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                      Sign In
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabButton, !isLogin && styles.tabButtonActive]}
                  onPress={() => setIsLogin(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={!isLogin ? ['#8B0000', '#A00000'] : ['transparent', 'transparent']}
                    style={styles.tabGradient}
                  >
                    <Ionicons
                      name="create-outline"
                      size={20}
                      color={!isLogin ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
                      Register
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Form Section */}
              <View style={styles.formSection}>
                {/* Vehicle Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Number</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="card-outline" size={20} color="#8B0000" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                      placeholder="CAD-3379"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                    />
                  </View>
                  <Text style={styles.inputHint}>Format: ABC-1234</Text>
                </View>

                {isLogin ? (
                  <>
                    {/* LOGIN - Password Only */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Password</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={20} color="#8B0000" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Enter password"
                          placeholderTextColor="#9CA3AF"
                          secureTextEntry={true}
                        />
                      </View>
                    </View>

                    {/* Login Button */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleLogin}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#8B0000', '#A00000']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionGradient}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <>
                            <Text style={styles.actionText}>Login</Text>
                            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Info Card */}
                    <View style={styles.infoCard}>
                      <Ionicons name="information-circle" size={20} color="#8B0000" />
                      <Text style={styles.infoText}>
                        👋 Login using your vehicle number and password
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    {/* REGISTER - All Fields */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Select Brand</Text>
                      <View style={styles.brandGrid}>
                        {brands.map((item) => (
                          <TouchableOpacity
                            key={item.name}
                            style={[
                              styles.brandItem,
                              brand === item.name && styles.brandItemActive,
                            ]}
                            onPress={() => setBrand(item.name)}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name={item.icon}
                              size={24}
                              color={brand === item.name ? '#8B0000' : '#9CA3AF'}
                            />
                            <Text
                              style={[
                                styles.brandText,
                                brand === item.name && styles.brandTextActive,
                              ]}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Model & Year */}
                    <View style={styles.rowInputs}>
                      <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.inputLabel}>Model</Text>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={styles.input}
                            value={model}
                            onChangeText={setModel}
                            placeholder="Vezel"
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                      </View>

                      <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.inputLabel}>Year</Text>
                        <View style={styles.inputWrapper}>
                          <TextInput
                            style={styles.input}
                            value={year}
                            onChangeText={setYear}
                            placeholder="2014"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            maxLength={4}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Engine Type */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Engine Type</Text>
                      <View style={styles.engineGrid}>
                        {engineTypes.map((item) => (
                          <TouchableOpacity
                            key={item.name}
                            style={[
                              styles.engineItem,
                              engineType === item.name && styles.engineItemActive,
                            ]}
                            onPress={() => setEngineType(item.name)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.engineIconCircle,
                                engineType === item.name && { backgroundColor: item.color },
                              ]}
                            >
                              <Ionicons
                                name={item.icon}
                                size={20}
                                color={engineType === item.name ? '#FFFFFF' : item.color}
                              />
                            </View>
                            <Text
                              style={[
                                styles.engineText,
                                engineType === item.name && styles.engineTextActive,
                              ]}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Password */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Password</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={20} color="#8B0000" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Min 6 characters"
                          placeholderTextColor="#9CA3AF"
                          secureTextEntry={true}
                        />
                      </View>
                      <Text style={styles.inputHint}>Must be at least 6 characters</Text>
                    </View>

                    {/* Register Button */}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleRegister}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#8B0000', '#A00000']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionGradient}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <>
                            <Text style={styles.actionText}>Create Account</Text>
                            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Info Card */}
                    <View style={styles.infoCard}>
                      <Ionicons name="information-circle" size={20} color="#8B0000" />
                      <Text style={styles.infoText}>
                        ✨ Register your vehicle to unlock diagnostic features
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Footer */}
            <Text style={styles.footerText}>
              Secure • Encrypted • Private
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  redGlowTop: {
    position: 'absolute',
    top: -100,
    left: -50,
    right: -50,
    height: 300,
    backgroundColor: '#8B0000',
    opacity: 0.05,
    borderRadius: 200,
    transform: [{ scaleX: 2 }],
  },
  redGlowBottom: {
    position: 'absolute',
    bottom: -100,
    left: -50,
    right: -50,
    height: 200,
    backgroundColor: '#8B0000',
    opacity: 0.03,
    borderRadius: 150,
    transform: [{ scaleX: 1.5 }],
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  appTitleRed: {
    color: '#8B0000',
  },
  appSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  glassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#8B0000',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  formSection: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  brandItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  brandItemActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#8B0000',
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  brandTextActive: {
    color: '#8B0000',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  engineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  engineItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  engineItemActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#8B0000',
  },
  engineIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  engineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  engineTextActive: {
    color: '#8B0000',
  },
  actionButton: {
    marginTop: 8,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#8B0000',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#8B0000',
    lineHeight: 18,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#666',
    marginTop: 24,
  },
});