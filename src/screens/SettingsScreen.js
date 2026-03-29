import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert, Modal,
  Linking, ActivityIndicator, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, getDocs, query, where,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage keys
const PREFS_KEY = '@svd_preferences';
const HISTORY_KEY = '@svd_scan_history';

export default function SettingsScreen({ navigation }) {
  // Preferences (persisted)
  const [notifications, setNotifications] = useState(true);
  const [autoConnect, setAutoConnect] = useState(false);
  const [units, setUnits] = useState('metric'); // 'metric' or 'imperial'

  // Vehicle profile
  const [vehicleInfo, setVehicleInfo] = useState(null);

  // Maintenance
  const [maintenanceItems, setMaintenanceItems] = useState([
    { id: '1', title: 'Oil Change', interval: '5,000 km', lastDone: '', nextDue: '' },
    { id: '2', title: 'Tire Rotation', interval: '10,000 km', lastDone: '', nextDue: '' },
    { id: '3', title: 'Brake Inspection', interval: '20,000 km', lastDone: '', nextDue: '' },
    { id: '4', title: 'Air Filter', interval: '15,000 km', lastDone: '', nextDue: '' },
    { id: '5', title: 'Coolant Flush', interval: '40,000 km', lastDone: '', nextDue: '' },
    { id: '6', title: 'Spark Plugs', interval: '50,000 km', lastDone: '', nextDue: '' },
  ]);

  // Data stats
  const [dataStats, setDataStats] = useState({ scans: 0, faults: 0, lastScan: 'N/A' });

  // Modals
  const [guideVisible, setGuideVisible] = useState(false);
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [unitsModalVisible, setUnitsModalVisible] = useState(false);
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState(false);
  const [dataUsageModalVisible, setDataUsageModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Load preferences from AsyncStorage on mount
  useEffect(() => {
    loadPreferences();
    loadVehicleProfile();
    loadDataStats();
    loadMaintenanceData();
  }, []);

  // Save preferences whenever they change
  useEffect(() => {
    savePreferences();
  }, [notifications, autoConnect, units]);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(PREFS_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        setNotifications(prefs.notifications ?? true);
        setAutoConnect(prefs.autoConnect ?? false);
        setUnits(prefs.units ?? 'metric');
      }
    } catch (e) {
      console.warn('Error loading preferences:', e);
    }
  };

  const savePreferences = async () => {
    try {
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({
        notifications, autoConnect, units,
      }));
    } catch (e) {
      console.warn('Error saving preferences:', e);
    }
  };

  const loadVehicleProfile = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userVehicleDoc = await getDoc(doc(db, 'userVehicles', userId));
      if (userVehicleDoc.exists()) {
        const vehicleId = userVehicleDoc.data().vehicleId;
        const vehicleDoc = await getDoc(doc(db, 'vehicles', vehicleId));
        if (vehicleDoc.exists()) {
          setVehicleInfo({ id: vehicleId, ...vehicleDoc.data() });
        }
      }
    } catch (e) {
      console.warn('Error loading vehicle:', e);
    }
  };

  const loadDataStats = async () => {
    try {
      const historyData = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyData) {
        const history = JSON.parse(historyData);
        setDataStats({
          scans: history.length,
          faults: history.reduce((sum, h) => sum + (h.faultCount || 0), 0),
          lastScan: history.length > 0 ? history[history.length - 1].date : 'N/A',
        });
      }
    } catch (e) {
      console.warn('Error loading data stats:', e);
    }
  };

  const loadMaintenanceData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const maintDoc = await getDoc(doc(db, 'maintenance', userId));
      if (maintDoc.exists()) {
        setMaintenanceItems(maintDoc.data().items || maintenanceItems);
      }
    } catch (e) {
      console.warn('Error loading maintenance:', e);
    }
  };

  // ---- ACTIONS ----

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'This will permanently delete all diagnostic records from this device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await AsyncStorage.removeItem(HISTORY_KEY);
              setDataStats({ scans: 0, faults: 0, lastScan: 'N/A' });
              Alert.alert('✅ Cleared', 'All diagnostic history has been deleted.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear history: ' + e.message);
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleCloudSync = async () => {
    setSyncing(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('Not logged in');

      // Backup preferences
      const prefs = { notifications, autoConnect, units };
      await setDoc(doc(db, 'userSettings', userId), {
        preferences: prefs,
        maintenance: maintenanceItems,
        syncedAt: new Date().toISOString(),
      }, { merge: true });

      // Backup local history
      const historyData = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyData) {
        await setDoc(doc(db, 'userHistory', userId), {
          records: JSON.parse(historyData),
          syncedAt: new Date().toISOString(),
        }, { merge: true });
      }

      Alert.alert('✅ Synced', 'Your data has been backed up to the cloud successfully!');
    } catch (e) {
      Alert.alert('Sync Failed', e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    setSyncing(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) throw new Error('Not logged in');

      const settingsDoc = await getDoc(doc(db, 'userSettings', userId));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.preferences) {
          setNotifications(data.preferences.notifications ?? true);
          setAutoConnect(data.preferences.autoConnect ?? false);
          setUnits(data.preferences.units ?? 'metric');
        }
        if (data.maintenance) {
          setMaintenanceItems(data.maintenance);
        }
      }

      const historyDoc = await getDoc(doc(db, 'userHistory', userId));
      if (historyDoc.exists() && historyDoc.data().records) {
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(historyDoc.data().records));
        await loadDataStats();
      }

      Alert.alert('✅ Restored', 'Your data has been restored from the cloud!');
    } catch (e) {
      Alert.alert('Restore Failed', e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleContactSupport = () => {
    const email = 'support@smartvehiclediagnostic.com';
    const subject = 'Support Request - Smart Vehicle Diagnostic';
    const body = `\nApp Version: 1.0.0\nUser: ${auth.currentUser?.email}\nDevice Info: React Native\n\nDescribe your issue:\n`;
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {
      Alert.alert('No Email App', 'Please email us at:\nsupport@smartvehiclediagnostic.com');
    });
  };

  const handleRateApp = () => {
    Alert.alert(
      '⭐ Rate Us',
      'Thank you for using Smart Vehicle Diagnostic! Your rating helps us improve.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Rate Now ⭐',
          onPress: () => {
            // Try Play Store first, fall back to alert
            Linking.openURL('market://details?id=com.smartvehiclediagnostic').catch(() => {
              Linking.openURL('https://play.google.com/store/apps/details?id=com.smartvehiclediagnostic').catch(() => {
                Alert.alert('Thank You', 'We appreciate your support! Rating will be available once the app is published on the store.');
              });
            });
          },
        },
      ]
    );
  };

  const handleSaveMaintenance = async (updatedItems) => {
    setMaintenanceItems(updatedItems);
    try {
      const userId = auth.currentUser?.uid;
      if (userId) {
        await setDoc(doc(db, 'maintenance', userId), {
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Error saving maintenance:', e);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  // ---- COMPONENTS ----

  const SettingItem = ({ icon, iconName, title, subtitle, onPress, rightComponent }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIconCircle}>
          {iconName ? (
            <Ionicons name={iconName} size={20} color="#8B0000" />
          ) : (
            <Text style={styles.settingIconText}>{icon}</Text>
          )}
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (
        onPress && <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  // ---- RENDER ----

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#8B0000" />

      {/* Header */}
      <LinearGradient colors={['#8B0000', '#A00000']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient colors={['#8B0000', '#A00000']} style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {auth.currentUser?.email?.charAt(0).toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {auth.currentUser?.email?.split('@')[0]}
            </Text>
            <Text style={styles.profileEmail}>
              {auth.currentUser?.email}
            </Text>
          </View>
          <View style={styles.profileBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.profileBadgeText}>Active</Text>
          </View>
        </View>

        {/* App Preferences */}
        <SectionHeader title="App Preferences" />
        <View style={styles.settingSection}>
          <SettingItem
            iconName="notifications-outline"
            title="Notifications"
            subtitle="Receive diagnostic alerts"
            rightComponent={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#E5E7EB', true: '#8B0000' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            iconName="bluetooth-outline"
            title="Auto-Connect OBD"
            subtitle="Connect to last device automatically"
            rightComponent={
              <Switch
                value={autoConnect}
                onValueChange={setAutoConnect}
                trackColor={{ false: '#E5E7EB', true: '#8B0000' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingItem
            iconName="speedometer-outline"
            title="Units"
            subtitle={units === 'metric' ? 'Metric (km/h, °C)' : 'Imperial (mph, °F)'}
            onPress={() => setUnitsModalVisible(true)}
          />
        </View>

        {/* Data & Storage */}
        <SectionHeader title="Data & Storage" />
        <View style={styles.settingSection}>
          <SettingItem
            iconName="bar-chart-outline"
            title="Data Usage"
            subtitle="View diagnostic data statistics"
            onPress={() => setDataUsageModalVisible(true)}
          />
          <SettingItem
            iconName="trash-outline"
            title="Clear History"
            subtitle="Delete all diagnostic records"
            onPress={handleClearHistory}
            rightComponent={
              clearing ? <ActivityIndicator color="#8B0000" size="small" /> : undefined
            }
          />
          <SettingItem
            iconName="cloud-upload-outline"
            title="Cloud Sync"
            subtitle="Backup & restore data to Firebase"
            onPress={() => {
              Alert.alert(
                '☁️ Cloud Sync',
                'Choose an action:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Backup to Cloud', onPress: handleCloudSync },
                  { text: 'Restore from Cloud', onPress: handleRestoreFromCloud },
                ]
              );
            }}
            rightComponent={
              syncing ? <ActivityIndicator color="#8B0000" size="small" /> : undefined
            }
          />
        </View>

        {/* Vehicle Settings */}
        <SectionHeader title="Vehicle Settings" />
        <View style={styles.settingSection}>
          <SettingItem
            iconName="car-sport-outline"
            title="Vehicle Profile"
            subtitle={vehicleInfo ? `${vehicleInfo.brand} ${vehicleInfo.model} (${vehicleInfo.year})` : 'View your vehicle details'}
            onPress={() => setVehicleModalVisible(true)}
          />
          <SettingItem
            iconName="construct-outline"
            title="Maintenance Schedule"
            subtitle="Set service reminders"
            onPress={() => setMaintenanceModalVisible(true)}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.settingSection}>
          <SettingItem
            iconName="information-circle-outline"
            title="App Version"
            subtitle="1.0.0"
          />
          <SettingItem
            iconName="book-outline"
            title="User Guide"
            subtitle="Learn how to use the app"
            onPress={() => setGuideVisible(true)}
          />
          <SettingItem
            iconName="mail-outline"
            title="Contact Support"
            subtitle="Get help from our team"
            onPress={handleContactSupport}
          />
          <SettingItem
            iconName="star-outline"
            title="Rate App"
            subtitle="Share your feedback"
            onPress={handleRateApp}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <LinearGradient colors={['#8B0000', '#A00000']} style={styles.logoutGradient}>
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          Smart Vehicle Diagnostic v1.0.0{'\n'}
          Made with ❤️ for Vehicle Owners
        </Text>
      </ScrollView>

      {/* ===== MODALS ===== */}

      {/* User Guide Modal */}
      <Modal visible={guideVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📖 User Guide</Text>
              <TouchableOpacity onPress={() => setGuideVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8B0000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <GuideSection
                icon="bluetooth"
                title="1. Connect OBD-II Adapter"
                body="Plug your ELM327 Bluetooth adapter into your vehicle's OBD-II port (usually under the dashboard). Turn the ignition ON. Go to the Home screen and tap 'Connect OBD-II' to scan for available devices."
              />
              <GuideSection
                icon="speedometer"
                title="2. View Live Data"
                body="Once connected, go to Dashboard to see real-time engine data including RPM, speed, coolant temperature, throttle position, fuel level, and battery voltage — all updated live."
              />
              <GuideSection
                icon="warning"
                title="3. Scan Fault Codes"
                body="Go to Fault Codes and tap 'Scan'. The app reads diagnostic trouble codes (DTCs) from your vehicle and shows their descriptions, causes, and fixes — specific to Toyota, Nissan, and Honda models."
              />
              <GuideSection
                icon="heart"
                title="4. Engine Health"
                body="The Engine Health screen gives an overall health score based on your vehicle's sensor readings. Monitor parameters and get maintenance recommendations."
              />
              <GuideSection
                icon="analytics"
                title="5. Data Charts"
                body="View RPM, temperature, and fuel trends over time with interactive charts. This helps identify patterns and potential issues."
              />
              <GuideSection
                icon="settings"
                title="6. Settings"
                body="Configure notifications, unit preferences (metric/imperial), maintenance schedules, and cloud backup. All your preferences are saved automatically."
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Vehicle Profile Modal */}
      <Modal visible={vehicleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🚗 Vehicle Profile</Text>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8B0000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {vehicleInfo ? (
                <View>
                  <ProfileRow label="Brand" value={vehicleInfo.brand || 'N/A'} icon="car-sport" />
                  <ProfileRow label="Model" value={vehicleInfo.model || 'N/A'} icon="construct" />
                  <ProfileRow label="Year" value={vehicleInfo.year || 'N/A'} icon="calendar" />
                  <ProfileRow label="Engine Type" value={vehicleInfo.engineType || 'N/A'} icon="flash" />
                  <ProfileRow label="Vehicle Number" value={vehicleInfo.vehicleNumber || 'N/A'} icon="card" />
                  <View style={styles.profileNote}>
                    <Ionicons name="information-circle" size={18} color="#8B0000" />
                    <Text style={styles.profileNoteText}>
                      To change your vehicle details, please logout and register with new information.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="car-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No Vehicle Registered</Text>
                  <Text style={styles.emptySubtext}>Register a vehicle to see your profile here.</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Units Modal */}
      <Modal visible={unitsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📏 Units</Text>
              <TouchableOpacity onPress={() => setUnitsModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8B0000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={[styles.unitOption, units === 'metric' && styles.unitOptionActive]}
                onPress={() => { setUnits('metric'); setUnitsModalVisible(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.unitOptionLeft}>
                  <Text style={styles.unitOptionTitle}>Metric</Text>
                  <Text style={styles.unitOptionDesc}>km/h, °C, liters, kPa</Text>
                </View>
                {units === 'metric' && <Ionicons name="checkmark-circle" size={24} color="#8B0000" />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitOption, units === 'imperial' && styles.unitOptionActive]}
                onPress={() => { setUnits('imperial'); setUnitsModalVisible(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.unitOptionLeft}>
                  <Text style={styles.unitOptionTitle}>Imperial</Text>
                  <Text style={styles.unitOptionDesc}>mph, °F, gallons, PSI</Text>
                </View>
                {units === 'imperial' && <Ionicons name="checkmark-circle" size={24} color="#8B0000" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Data Usage Modal */}
      <Modal visible={dataUsageModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { maxHeight: 380 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Data Usage</Text>
              <TouchableOpacity onPress={() => setDataUsageModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8B0000" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <Ionicons name="scan-outline" size={28} color="#8B0000" />
                  <Text style={styles.statValue}>{dataStats.scans}</Text>
                  <Text style={styles.statLabel}>Total Scans</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="warning-outline" size={28} color="#F59E0B" />
                  <Text style={styles.statValue}>{dataStats.faults}</Text>
                  <Text style={styles.statLabel}>Faults Found</Text>
                </View>
              </View>
              <ProfileRow label="Last Scan" value={dataStats.lastScan} icon="time" />
              <ProfileRow label="App Version" value="1.0.0" icon="information-circle" />
              <ProfileRow label="Account" value={auth.currentUser?.email || 'N/A'} icon="person" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Maintenance Schedule Modal */}
      <Modal visible={maintenanceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔧 Maintenance</Text>
              <TouchableOpacity onPress={() => setMaintenanceModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8B0000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {maintenanceItems.map((item, index) => (
                <View key={item.id} style={styles.maintItem}>
                  <View style={styles.maintHeader}>
                    <View style={styles.maintIconCircle}>
                      <Ionicons name="construct" size={18} color="#8B0000" />
                    </View>
                    <View style={styles.maintInfo}>
                      <Text style={styles.maintTitle}>{item.title}</Text>
                      <Text style={styles.maintInterval}>Every {item.interval}</Text>
                    </View>
                  </View>
                  <View style={styles.maintInputRow}>
                    <View style={styles.maintInputGroup}>
                      <Text style={styles.maintInputLabel}>Last Done</Text>
                      <TextInput
                        style={styles.maintInput}
                        placeholder="e.g. 2026-01-15"
                        placeholderTextColor="#9CA3AF"
                        value={item.lastDone}
                        onChangeText={(text) => {
                          const updated = [...maintenanceItems];
                          updated[index] = { ...item, lastDone: text };
                          setMaintenanceItems(updated);
                        }}
                        onBlur={() => handleSaveMaintenance(maintenanceItems)}
                      />
                    </View>
                    <View style={styles.maintInputGroup}>
                      <Text style={styles.maintInputLabel}>Next Due</Text>
                      <TextInput
                        style={styles.maintInput}
                        placeholder="e.g. 2026-06-15"
                        placeholderTextColor="#9CA3AF"
                        value={item.nextDue}
                        onChangeText={(text) => {
                          const updated = [...maintenanceItems];
                          updated[index] = { ...item, nextDue: text };
                          setMaintenanceItems(updated);
                        }}
                        onBlur={() => handleSaveMaintenance(maintenanceItems)}
                      />
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity
                style={styles.saveMaintenanceButton}
                onPress={() => {
                  handleSaveMaintenance(maintenanceItems);
                  Alert.alert('✅ Saved', 'Maintenance schedule updated!');
                  setMaintenanceModalVisible(false);
                }}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#8B0000', '#A00000']} style={styles.saveMaintenanceGradient}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.saveMaintenanceText}>Save Schedule</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper components
function GuideSection({ icon, title, body }) {
  return (
    <View style={styles.guideSection}>
      <View style={styles.guideSectionHeader}>
        <Ionicons name={icon} size={20} color="#8B0000" />
        <Text style={styles.guideSectionTitle}>{title}</Text>
      </View>
      <Text style={styles.guideSectionBody}>{body}</Text>
    </View>
  );
}

function ProfileRow({ label, value, icon }) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowLeft}>
        <Ionicons name={icon} size={18} color="#8B0000" />
        <Text style={styles.profileRowLabel}>{label}</Text>
      </View>
      <Text style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // Header
  header: {
    paddingBottom: 16,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: { flex: 1 },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileInitial: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  profileEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  profileBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },

  // Section Header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 16,
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Setting Section
  settingSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingIconText: {
    fontSize: 18,
  },
  settingText: { flex: 1 },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Logout
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 30,
    borderRadius: 14,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Footer
  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 40,
    lineHeight: 18,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },

  // Guide
  guideSection: {
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  guideSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  guideSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  guideSectionBody: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },

  // Profile Row
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  profileRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profileRowLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  profileRowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    maxWidth: '50%',
    textAlign: 'right',
  },
  profileNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#8B0000',
  },
  profileNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#8B0000',
    lineHeight: 18,
  },

  // Units
  unitOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  unitOptionActive: {
    borderColor: '#8B0000',
    backgroundColor: '#FEF2F2',
  },
  unitOptionLeft: {},
  unitOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  unitOptionDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },

  // Data stats
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Maintenance
  maintItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  maintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  maintIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  maintInfo: { flex: 1 },
  maintTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  maintInterval: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  maintInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  maintInputGroup: {
    flex: 1,
  },
  maintInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  maintInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  saveMaintenanceButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
  },
  saveMaintenanceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveMaintenanceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
});