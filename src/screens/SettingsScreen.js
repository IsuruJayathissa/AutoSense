import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function SettingsScreen({ navigation }) {
  const [notifications, setNotifications] = useState(true);
  const [autoConnect, setAutoConnect] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

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
          }
        }
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, onPress, rightComponent }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && (
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      {rightComponent || (
        onPress && <Text style={styles.settingArrow}>›</Text>
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>
        <View style={{width: 50}} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {auth.currentUser?.email?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {auth.currentUser?.email?.split('@')[0]}
            </Text>
            <Text style={styles.profileEmail}>
              {auth.currentUser?.email}
            </Text>
          </View>
        </View>

        {/* App Preferences */}
        <SectionHeader title="App Preferences" />
        
        <View style={styles.settingSection}>
          <SettingItem
            icon="🔔"
            title="Notifications"
            subtitle="Receive diagnostic alerts"
            rightComponent={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#ccc', true: '#007AFF' }}
                thumbColor="#fff"
              />
            }
          />

          <SettingItem
            icon="🔌"
            title="Auto-Connect OBD"
            subtitle="Connect to last device automatically"
            rightComponent={
              <Switch
                value={autoConnect}
                onValueChange={setAutoConnect}
                trackColor={{ false: '#ccc', true: '#007AFF' }}
                thumbColor="#fff"
              />
            }
          />

          <SettingItem
            icon="🌙"
            title="Dark Mode"
            subtitle="Use dark theme"
            rightComponent={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#ccc', true: '#007AFF' }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Data & Storage */}
        <SectionHeader title="Data & Storage" />
        
        <View style={styles.settingSection}>
          <SettingItem
            icon="📊"
            title="Data Usage"
            subtitle="View diagnostic data statistics"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />

          <SettingItem
            icon="🗑️"
            title="Clear History"
            subtitle="Delete all diagnostic records"
            onPress={() => {
              Alert.alert(
                'Clear History',
                'This will delete all diagnostic records. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => Alert.alert('Success', 'History cleared')
                  }
                ]
              );
            }}
          />

          <SettingItem
            icon="☁️"
            title="Cloud Sync"
            subtitle="Backup data to Firebase"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />
        </View>

        {/* Vehicle Settings */}
        <SectionHeader title="Vehicle Settings" />
        
        <View style={styles.settingSection}>
          <SettingItem
            icon="🚗"
            title="Vehicle Profile"
            subtitle="Set your vehicle details"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />

          <SettingItem
            icon="📏"
            title="Units"
            subtitle="Metric (km/h, °C)"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />

          <SettingItem
            icon="🔧"
            title="Maintenance Schedule"
            subtitle="Set service reminders"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        
        <View style={styles.settingSection}>
          <SettingItem
            icon="ℹ️"
            title="App Version"
            subtitle="1.0.0"
          />

          <SettingItem
            icon="📖"
            title="User Guide"
            subtitle="Learn how to use the app"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />

          <SettingItem
            icon="📧"
            title="Contact Support"
            subtitle="Get help from our team"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />

          <SettingItem
            icon="⭐"
            title="Rate App"
            subtitle="Share your feedback"
            onPress={() => Alert.alert('Coming Soon', 'Feature under development')}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          Smart Vehicle Diagnostic v1.0.0{'\n'}
          Made with ❤️ for Vehicle Owners
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
  },
  backText: { color: '#fff', fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1 },
  
  // Profile Card
  profileCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInitial: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  // Section Header
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 15,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Setting Section
  settingSection: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  settingText: { flex: 1 },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 24,
    color: '#ccc',
    fontWeight: '300',
  },

  // Logout Button
  logoutButton: {
    backgroundColor: '#FF3B30',
    margin: 15,
    marginTop: 30,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  logoutIcon: { fontSize: 20, marginRight: 8 },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Footer
  footer: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 30,
    lineHeight: 18,
  },
});