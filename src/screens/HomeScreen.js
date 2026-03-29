import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

export default function HomeScreen({ navigation }) {
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicleData();
  }, []);

  const loadVehicleData = async () => {
    try {
      const userId = auth.currentUser.uid;
      const userVehicleDoc = await getDoc(doc(db, 'userVehicles', userId));
      
      if (userVehicleDoc.exists()) {
        const vehicleId = userVehicleDoc.data().vehicleId;
        const vehicleDoc = await getDoc(doc(db, 'vehicles', vehicleId));
        
        if (vehicleDoc.exists()) {
          setVehicleData(vehicleDoc.data());
        }
      }
    } catch (error) {
      console.error('Error loading vehicle:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const quickActions = [
    {
      id: '1',
      icon: 'speedometer-outline',
      title: 'Dashboard',
      subtitle: 'Live Data',
      screen: 'Dashboard',
      gradient: ['#8B0000', '#A00000'], // Dark Red
    },
    {
      id: '2',
      icon: 'search-outline',
      title: 'Scan Faults',
      subtitle: 'DTC Codes',
      screen: 'FaultCodes',
      gradient: ['#8B0000', '#A00000'], // Dark Red
    },
    {
      id: '3',
      icon: 'heart-outline',
      title: 'Engine Health',
      subtitle: 'Status Check',
      screen: 'EngineHealth',
      gradient: ['#8B0000', '#A00000'], // Dark Red
    },
    {
      id: '4',
      icon: 'time-outline',
      title: 'History',
      subtitle: 'Past Scans',
      screen: 'History',
      gradient: ['#8B0000', '#A00000'], // Dark Red
    },
  ];

  const secondaryActions = [
    {
      id: '5',
      icon: 'analytics-outline',
      title: 'Data Charts',
      screen: 'DataCharts',
      color: '#8B0000',
    },
    {
      id: '6',
      icon: 'construct-outline',
      title: 'Maintenance',
      screen: 'History',
      color: '#8B0000',
    },
    {
      id: '7',
      icon: 'settings-outline',
      title: 'Settings',
      screen: 'Settings',
      color: '#8B0000',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B0000" />
        <Text style={styles.loadingText}>Loading your vehicle...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.headerTitle}>
              Auto<Text style={styles.headerTitleRed}>Sense</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Vehicle Card */}
          {vehicleData ? (
            <View style={styles.vehicleCardContainer}>
              <View style={styles.vehicleCard}>
                {/* Red Accent Border */}
                <LinearGradient
                  colors={['#8B0000', '#A00000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.vehicleCardBorder}
                />
                
                <View style={styles.vehicleHeader}>
                  <View style={styles.vehicleIconCircle}>
                    <LinearGradient
                      colors={['#1F2937', '#374151']}
                      style={styles.vehicleIconGradient}
                    >
                      <Ionicons name="car-sport" size={28} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                  <View style={styles.vehicleInfoSection}>
                    <Text style={styles.vehicleNumber}>{vehicleData.vehicleNumber}</Text>
                    <Text style={styles.vehicleModel}>
                      {vehicleData.brand} {vehicleData.model}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Active</Text>
                  </View>
                </View>

                <View style={styles.vehicleStats}>
                  <View style={styles.statItem}>
                    <View style={[styles.statIconCircle, { backgroundColor: '#1F293720' }]}>
                      <Ionicons name="calendar-outline" size={18} color="#1F2937" />
                    </View>
                    <Text style={styles.statLabel}>Year</Text>
                    <Text style={styles.statValue}>{vehicleData.year}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <View style={[styles.statIconCircle, { backgroundColor: '#EF444420' }]}>
                      <Ionicons name="speedometer-outline" size={18} color="#EF4444" />
                    </View>
                    <Text style={styles.statLabel}>Engine</Text>
                    <Text style={styles.statValue}>{vehicleData.engineType}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <View style={[styles.statIconCircle, { backgroundColor: '#FFF7ED' }]}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                    </View>
                    <Text style={styles.statLabel}>Health</Text>
                    <Text style={styles.statValue}>Good</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noVehicleCard}>
              <Ionicons name="car-outline" size={48} color="#9CA3AF" />
              <Text style={styles.noVehicleText}>No vehicle registered</Text>
            </View>
          )}

          {/* Quick Actions Title */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Ionicons name="flash" size={20} color="#1F2937" />
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={action.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionGradient}
                >
                  <View style={styles.actionIconCircle}>
                    <Ionicons name={action.icon} size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                  <View style={styles.actionArrow}>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Secondary Actions */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>More Options</Text>
            <Ionicons name="apps" size={20} color="#1F2937" />
          </View>

          <View style={styles.secondaryActionsRow}>
            {secondaryActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.secondaryCard}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.8}
              >
                <View style={styles.secondaryCardContent}>
                  <View style={[styles.secondaryIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text style={styles.secondaryTitle}>{action.title}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* OBD Connection Card */}
          <View style={styles.obdCard}>
            <LinearGradient
              colors={['#8B0000', '#A00000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.obdCardBorder}
            />
            <View style={styles.obdHeader}>
              <View style={styles.obdIconCircle}>
                <Ionicons name="bluetooth-outline" size={24} color="#1F2937" />
              </View>
              <View style={styles.obdInfo}>
                <Text style={styles.obdTitle}>OBD-II Connection</Text>
                <View style={styles.obdStatus}>
                  <View style={styles.obdStatusDot} />
                  <Text style={styles.obdStatusText}>Not Connected</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.obdConnectButton}
              onPress={() => navigation.navigate('OBDConnection')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.obdButtonGradient}
              >
                <Ionicons name="link-outline" size={20} color="#FFFFFF" />
                <Text style={styles.obdButtonText}>Connect Device</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Bottom Spacing */}
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
  },
  headerTitleRed: {
    color: '#8B0000',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  vehicleCardContainer: {
    marginBottom: 24,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
  vehicleCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  vehicleIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 16,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  vehicleIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleInfoSection: {
    flex: 1,
  },
  vehicleNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 1,
  },
  vehicleModel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  vehicleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  noVehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noVehicleText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionCard: {
    width: CARD_WIDTH,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionGradient: {
    padding: 20,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.95,
  },
  actionArrow: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryActionsRow: {
    marginBottom: 24,
  },
  secondaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  secondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  secondaryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  obdCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  obdCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  obdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  obdIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  obdInfo: {
    flex: 1,
  },
  obdTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  obdStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  obdStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B0000',
    marginRight: 6,
  },
  obdStatusText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  obdConnectButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  obdButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  obdButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});