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
  Modal,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

const { width } = Dimensions.get('window');

const VEHICLE_DATA = {
  Toyota:     ['Aqua', 'Axio', 'Allion', 'Camry', 'Corolla', 'Hiace', 'Hilux', 'Land Cruiser', 'Passo', 'Premio', 'Prius', 'RAV4', 'Rush', 'Vitz'],
  Honda:      ['Accord', 'Amaze', 'BR-V', 'City', 'Civic', 'CR-V', 'Fit', 'HR-V', 'Jazz', 'Vezel', 'WR-V'],
  Nissan:     ['Almera', 'Dayz', 'GT-R', 'Juke', 'Kicks', 'Leaf', 'March', 'Navara', 'Note', 'Patrol', 'Sunny', 'Teana', 'X-Trail'],
  Suzuki:     ['Alto', 'Baleno', 'Celerio', 'Dzire', 'Ertiga', 'Jimny', 'S-Cross', 'Swift', 'Vitara', 'Wagon R'],
  Mitsubishi: ['ASX', 'Eclipse Cross', 'Lancer', 'Mirage', 'Montero', 'Outlander', 'Pajero', 'Triton'],
  Hyundai:    ['Accent', 'Creta', 'Elantra', 'Grand i10', 'i10', 'i20', 'Ioniq', 'Kona', 'Santa Fe', 'Tucson', 'Venue'],
  Kia:        ['Carnival', 'Cerato', 'EV6', 'Niro', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Sportage'],
  BMW:        ['1 Series', '3 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7'],
  Mercedes:   ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC', 'GLE', 'S-Class'],
  Ford:       ['EcoSport', 'Endeavour', 'Explorer', 'F-150', 'Fiesta', 'Focus', 'Mustang', 'Ranger'],
  Other:      ['Other'],
};
const BRANDS       = Object.keys(VEHICLE_DATA);
const ENGINE_TYPES = ['Petrol', 'Diesel', 'Hybrid'];

const VEHICLE_NUMBER_REGEX = /^[A-Z]{2,3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ModalDropdown({ label, value, options, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.dropdownWrapper}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdownTrigger, disabled && styles.dropdownTriggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.dropdownTriggerText, !value && styles.dropdownPlaceholder]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={disabled ? '#D1D5DB' : '#8B0000'} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{label}</Text>
                  <TouchableOpacity onPress={() => setOpen(false)}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.modalItem, value === item && styles.modalItemSelected]}
                      onPress={() => { onSelect(item); setOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modalItemText, value === item && styles.modalItemTextSelected]}>
                        {item}
                      </Text>
                      {value === item && <Ionicons name="checkmark-circle" size={18} color="#8B0000" />}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// Maps Firebase Auth error codes to friendly messages
function describeAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-email':         return 'The email address is invalid.';
    case 'auth/email-already-in-use':  return 'This email is already registered.';
    case 'auth/weak-password':         return 'Password must be at least 6 characters.';
    case 'auth/wrong-password':        return 'The password you entered is incorrect.';
    case 'auth/user-not-found':        return 'No account found for this vehicle.';
    case 'auth/too-many-requests':     return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':return 'Network error. Check your connection.';
    case 'auth/invalid-credential':    return 'Invalid email or password.';
    default:                           return error?.message || 'Authentication failed.';
  }
}

export default function VehicleAuthScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Shared form data
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [password, setPassword] = useState('');

  // Register-only fields
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [engineType, setEngineType] = useState('');

  // Forgot-password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotVehicleNumber, setForgotVehicleNumber] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const validateVehicleNumber = (number) => VEHICLE_NUMBER_REGEX.test(number.toUpperCase());

  // Look up the email associated with a registered vehicle number.
  // Returns the email string, or null if the vehicle is not registered.
  const lookupEmailByVehicleNumber = async (vehicleNo) => {
    const vehiclesRef = collection(db, 'vehicles');
    const q = query(vehiclesRef, where('vehicleNumber', '==', vehicleNo.toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data().email || null;
  };

  // ── Sign In ────────────────────────────────────────────────────────────────
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
      const linkedEmail = await lookupEmailByVehicleNumber(vehicleNumber);
      if (!linkedEmail) {
        Alert.alert('Not Registered', 'This vehicle is not registered. Please register first.');
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, linkedEmail, password);
      const userId = userCredential.user.uid;

      await setDoc(doc(db, 'userVehicles', userId), {
        vehicleNumber: vehicleNumber.toUpperCase(),
      }, { merge: true });

      // AppNavigator listens to onAuthStateChanged and will route to Home automatically.
    } catch (error) {
      Alert.alert('Login Failed', describeAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!vehicleNumber.trim() || !email.trim() || !password.trim() ||
        !confirmPassword.trim() || !brand || !model.trim() ||
        !year.trim() || !engineType) {
      Alert.alert('Incomplete', 'Please fill all required fields');
      return;
    }
    if (!validateVehicleNumber(vehicleNumber)) {
      Alert.alert('Invalid Format', 'Vehicle number: ABC-1234');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Please re-enter the same password in both fields');
      return;
    }

    setLoading(true);
    try {
      // Block duplicate vehicle registrations
      const existingEmail = await lookupEmailByVehicleNumber(vehicleNumber);
      if (existingEmail) {
        Alert.alert('Already Registered', 'This vehicle number is already registered.');
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const userId = userCredential.user.uid;

      const vehicleId = `VEH_${Date.now()}`;
      const vehicleData = {
        vehicleId,
        vehicleNumber: vehicleNumber.toUpperCase(),
        email: email.trim(),
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

      Alert.alert('Success! 🎉', 'Vehicle registered successfully!');
      // AppNavigator routes to Home via onAuthStateChanged.
    } catch (error) {
      Alert.alert('Registration Failed', describeAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!forgotVehicleNumber.trim()) {
      Alert.alert('Required', 'Please enter your vehicle number');
      return;
    }
    if (!validateVehicleNumber(forgotVehicleNumber)) {
      Alert.alert('Invalid Format', 'Vehicle number: ABC-1234');
      return;
    }

    setForgotLoading(true);
    try {
      const linkedEmail = await lookupEmailByVehicleNumber(forgotVehicleNumber);
      if (!linkedEmail) {
        Alert.alert('Not Registered', 'No account found for this vehicle number.');
        return;
      }

      await sendPasswordResetEmail(auth, linkedEmail);
      setForgotOpen(false);
      setForgotVehicleNumber('');
      Alert.alert(
        'Reset Email Sent',
        `A password reset link has been sent to ${linkedEmail}. Please check your inbox.`
      );
    } catch (error) {
      Alert.alert('Reset Failed', describeAuthError(error));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
            keyboardShouldPersistTaps="handled"
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
                {/* Vehicle Number — shared by both tabs */}
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
                    {/* LOGIN — Password */}
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
                          secureTextEntry
                        />
                      </View>
                    </View>

                    {/* Forgot Password Link */}
                    <TouchableOpacity
                      style={styles.forgotLinkWrapper}
                      onPress={() => setForgotOpen(true)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.forgotLinkText}>Forgot Password?</Text>
                    </TouchableOpacity>

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

                    <View style={styles.infoCard}>
                      <Ionicons name="information-circle" size={20} color="#8B0000" />
                      <Text style={styles.infoText}>
                        👋 Login using your vehicle number and password
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    {/* REGISTER */}
                    {/* Email */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="mail-outline" size={20} color="#8B0000" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          value={email}
                          onChangeText={setEmail}
                          placeholder="you@example.com"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                      <Text style={styles.inputHint}>Used for password recovery</Text>
                    </View>

                    <ModalDropdown
                      label="Vehicle Brand"
                      value={brand}
                      options={BRANDS}
                      onSelect={(b) => { setBrand(b); setModel(''); }}
                      placeholder="Select brand..."
                    />

                    <ModalDropdown
                      label="Vehicle Model"
                      value={model}
                      options={brand ? VEHICLE_DATA[brand] : []}
                      onSelect={setModel}
                      placeholder={brand ? 'Select model...' : 'Select brand first'}
                      disabled={!brand}
                    />

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Year</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.input}
                          value={year}
                          onChangeText={setYear}
                          placeholder="2008"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                          maxLength={4}
                        />
                      </View>
                    </View>

                    <ModalDropdown
                      label="Engine Type"
                      value={engineType}
                      options={ENGINE_TYPES}
                      onSelect={setEngineType}
                      placeholder="Select engine type..."
                    />

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
                          secureTextEntry
                        />
                      </View>
                      <Text style={styles.inputHint}>Must be at least 6 characters</Text>
                    </View>

                    {/* Confirm Password */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Confirm Password</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#8B0000" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          placeholder="Re-enter password"
                          placeholderTextColor="#9CA3AF"
                          secureTextEntry
                        />
                      </View>
                      {confirmPassword.length > 0 && password !== confirmPassword && (
                        <Text style={styles.errorHint}>Passwords do not match</Text>
                      )}
                    </View>

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

            <Text style={styles.footerText}>
              Secure • Encrypted • Private
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => !forgotLoading && setForgotOpen(false)}>
          <View style={styles.forgotOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.forgotCard}>
                <View style={styles.forgotHeader}>
                  <View style={styles.forgotIconCircle}>
                    <Ionicons name="key-outline" size={26} color="#8B0000" />
                  </View>
                  <TouchableOpacity
                    onPress={() => !forgotLoading && setForgotOpen(false)}
                    style={styles.forgotCloseBtn}
                  >
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.forgotTitle}>Reset Password</Text>
                <Text style={styles.forgotSubtitle}>
                  Enter your registered vehicle number. We'll send a password reset link to the email on file.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vehicle Number</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="card-outline" size={20} color="#8B0000" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={forgotVehicleNumber}
                      onChangeText={setForgotVehicleNumber}
                      placeholder="CAD-3379"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, { marginTop: 16 }]}
                  onPress={handleForgotPassword}
                  disabled={forgotLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8B0000', '#A00000']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.actionGradient}
                  >
                    {forgotLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={styles.actionText}>Send Reset Link</Text>
                        <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  errorHint: {
    fontSize: 12,
    color: '#B91C1C',
    marginLeft: 4,
    fontWeight: '600',
  },
  forgotLinkWrapper: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: -8,
  },
  forgotLinkText: {
    color: '#8B0000',
    fontSize: 13,
    fontWeight: '600',
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

  // Modal Dropdown (brand/model/engine)
  dropdownWrapper: { gap: 8 },
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  dropdownTriggerDisabled: { opacity: 0.5 },
  dropdownTriggerText: { fontSize: 16, color: '#1F2937', fontWeight: '500', flex: 1 },
  dropdownPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  modalItemSelected: { backgroundColor: '#FEF2F2' },
  modalItemText: { fontSize: 15, color: '#1F2937' },
  modalItemTextSelected: { color: '#8B0000', fontWeight: '600' },

  // Forgot Password Modal
  forgotOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  forgotCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  forgotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  forgotIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotCloseBtn: {
    padding: 4,
  },
  forgotTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
  },
  forgotSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 18,
  },
});
