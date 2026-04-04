import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
  Modal, FlatList, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

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

// ── Modal Dropdown Component ───────────────────────────────────────────────
function InlineDropdown({ label, value, options, onSelect, placeholder, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.dropdownWrapper}>
      <Text style={styles.label}>{label}</Text>

      {/* Trigger */}
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          disabled && styles.dropdownTriggerDisabled,
        ]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>
          {value || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={disabled ? '#D1D5DB' : '#8B0000'}
        />
      </TouchableOpacity>

      {/* Modal overlay list */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
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
                      style={[
                        styles.dropdownItem,
                        value === item && styles.dropdownItemSelected,
                      ]}
                      onPress={() => { onSelect(item); setOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        value === item && styles.dropdownItemTextSelected,
                      ]}>
                        {item}
                      </Text>
                      {value === item && (
                        <Ionicons name="checkmark-circle" size={18} color="#8B0000" />
                      )}
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

// ── Main Screen ────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [brand, setBrand]                     = useState('');
  const [model, setModel]                     = useState('');
  const [engineType, setEngineType]           = useState('');
  const [loading, setLoading]                 = useState(false);

  const handleBrandSelect = (b) => { setBrand(b); setModel(''); };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      alert('Please fill in all fields'); return;
    }
    if (!brand || !model || !engineType) {
      alert('Please select your vehicle brand, model and engine type'); return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match'); return;
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters'); return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert('Account created successfully!');
    } catch (error) {
      alert('Registration Failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Register to get started</Text>

      {/* Email */}
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#9CA3AF"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Password */}
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Min 6 characters"
        placeholderTextColor="#9CA3AF"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* Confirm Password */}
      <Text style={styles.label}>Confirm Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Re-enter password"
        placeholderTextColor="#9CA3AF"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {/* Divider */}
      <View style={styles.sectionDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Vehicle Details</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Brand dropdown */}
      <InlineDropdown
        label="Vehicle Brand"
        value={brand}
        options={BRANDS}
        onSelect={handleBrandSelect}
        placeholder="Select brand..."
      />

      {/* Model dropdown — disabled until brand selected */}
      <InlineDropdown
        label="Vehicle Model"
        value={model}
        options={brand ? VEHICLE_DATA[brand] : []}
        onSelect={setModel}
        placeholder={brand ? 'Select model...' : 'Select brand first'}
        disabled={!brand}
      />

      {/* Engine Type dropdown */}
      <InlineDropdown
        label="Engine Type"
        value={engineType}
        options={ENGINE_TYPES}
        onSelect={setEngineType}
        placeholder="Select engine type..."
      />

      {/* Register Button */}
      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleRegister}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Create Account</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:    { flex: 1, backgroundColor: '#FFFFFF' },
  container: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  title:     { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#1F2937' },
  subtitle:  { fontSize: 15, textAlign: 'center', marginBottom: 28, color: '#6B7280' },
  label:     { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 6 },

  input: {
    backgroundColor: '#FFFFFF', padding: 14, borderRadius: 10,
    marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB',
    fontSize: 15, color: '#1F2937',
  },

  // Dropdown
  dropdownWrapper: { marginBottom: 16 },

  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
  },
  dropdownTriggerDisabled: { backgroundColor: '#F9FAFB' },
  triggerText:             { fontSize: 15, color: '#1F2937', flex: 1 },
  triggerPlaceholder:      { color: '#9CA3AF' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30, maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },

  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected:     { backgroundColor: '#FEF2F2' },
  dropdownItemText:         { fontSize: 15, color: '#1F2937' },
  dropdownItemTextSelected: { color: '#8B0000', fontWeight: '600' },

  // Divider
  sectionDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText:    { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  // Button
  button: {
    backgroundColor: '#8B0000', padding: 16, borderRadius: 10,
    alignItems: 'center', marginTop: 16, marginBottom: 20,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkText:   { color: '#8B0000', fontSize: 14, textAlign: 'center' },
});
