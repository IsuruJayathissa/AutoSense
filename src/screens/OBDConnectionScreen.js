import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, PermissionsAndroid,
  Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BleManager } from 'react-native-ble-plx';
import OBDService from '../services/OBDService';

const manager = new BleManager();

export default function OBDConnectionScreen({ navigation }) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [status, setStatus] = useState('Ready to scan');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
        granted['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
        granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
      );
    }
    return true;
  };

  const startScan = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Bluetooth permissions are required');
      return;
    }

    setDevices([]);
    setScanning(true);
    setStatus('Scanning for OBD devices...');

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        setScanning(false);
        setStatus('Scan failed: ' + error.message);
        return;
      }

      if (device && device.name) {
        setDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          if (!exists) {
            return [...prev, device];
          }
          return prev;
        });
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
      setStatus('Scan complete');
    }, 10000);
  };

  const connectToDevice = async (device) => {
    try {
      manager.stopDeviceScan();
      setScanning(false);
      setConnecting(true);
      setStatus(`Connecting to ${device.name}...`);

      const success = await OBDService.connect(device.id);

      if (success) {
        setConnectedDevice(device);
        setConnected(true);
        setConnecting(false);
        setStatus('Connected!');
      } else {
        Alert.alert('Connection Failed', 'Could not initialize OBD-II communication. Make sure the device is an ELM327 adapter.');
        setStatus('Connection failed');
        setConnecting(false);
      }
    } catch (error) {
      Alert.alert('Connection Failed', error.message);
      setStatus('Connection failed');
      setConnecting(false);
    }
  };

  const getSignalIcon = (rssi) => {
    if (rssi > -60) return 'wifi';
    if (rssi > -80) return 'wifi-outline';
    return 'wifi-outline';
  };

  const getSignalColor = (rssi) => {
    if (rssi > -60) return '#10B981';
    if (rssi > -80) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>OBD-II Connection</Text>
          <View style={{ width: 40 }} />
        </View>

        {connected ? (
          <View style={styles.connectedContainer}>
            <View style={styles.connectedCard}>
              <View style={[styles.connectedCardBorder, { backgroundColor: '#10B981' }]} />
              <View style={styles.connectedIconCircle}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
              <Text style={styles.connectedText}>Connected!</Text>
              <Text style={styles.deviceNameText}>
                {connectedDevice?.name}
              </Text>

              <TouchableOpacity
                style={styles.liveDataButton}
                onPress={() => navigation.navigate('Dashboard', { isConnected: true })}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8B0000', '#A00000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.liveDataGradient}
                >
                  <Ionicons name="speedometer" size={22} color="#FFFFFF" />
                  <Text style={styles.liveDataButtonText}>View Live Data</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={() => {
                  OBDService.disconnect();
                  setConnected(false);
                  setConnectedDevice(null);
                  setStatus('Disconnected');
                }}
              >
                <Ionicons name="close-circle-outline" size={18} color="#8B0000" />
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Status */}
            <View style={styles.statusBar}>
              <View style={styles.statusLeft}>
                <Ionicons name="bluetooth" size={20} color="#8B0000" />
                <Text style={styles.statusText}>{status}</Text>
              </View>
              {connecting && <ActivityIndicator color="#8B0000" size="small" />}
            </View>

            {/* Scan Button */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={startScan}
              disabled={scanning || connecting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={scanning ? ['#6B7280', '#9CA3AF'] : ['#8B0000', '#A00000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.scanGradient}
              >
                {scanning ? (
                  <View style={styles.scanningContent}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.scanButtonText}>Scanning...</Text>
                  </View>
                ) : (
                  <View style={styles.scanningContent}>
                    <Ionicons name="search" size={22} color="#FFFFFF" />
                    <Text style={styles.scanButtonText}>Scan for OBD Devices</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Device List */}
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceCard}
                  onPress={() => connectToDevice(item)}
                  disabled={connecting}
                  activeOpacity={0.8}
                >
                  <View style={styles.deviceLeft}>
                    <View style={styles.deviceIconCircle}>
                      <Ionicons name="bluetooth" size={24} color="#8B0000" />
                    </View>
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>
                        {item.name || 'Unknown Device'}
                      </Text>
                      <Text style={styles.deviceId}>{item.id}</Text>
                    </View>
                  </View>
                  <View style={styles.deviceRight}>
                    <Ionicons
                      name={getSignalIcon(item.rssi)}
                      size={18}
                      color={getSignalColor(item.rssi)}
                    />
                    <Text style={[styles.deviceRssi, { color: getSignalColor(item.rssi) }]}>
                      {item.rssi} dBm
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#8B0000" />
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  {!scanning ? (
                    <>
                      <Ionicons name="bluetooth-outline" size={64} color="#D1D5DB" />
                      <Text style={styles.emptyTitle}>No Devices Found</Text>
                      <Text style={styles.emptySubtext}>
                        Make sure ELM327 is plugged into your car's OBD-II port and powered on.
                      </Text>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="large" color="#8B0000" />
                      <Text style={styles.emptyTitle}>Searching...</Text>
                    </>
                  )}
                </View>
              }
            />

            {/* Instructions */}
            <View style={styles.instructionCard}>
              <View style={styles.instructionCardBorder} />
              <Text style={styles.instructionTitle}>Before Scanning:</Text>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>1</Text>
                </View>
                <Text style={styles.instructionText}>Plug ELM327 into car's OBD-II port</Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>2</Text>
                </View>
                <Text style={styles.instructionText}>Turn car ignition ON</Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>3</Text>
                </View>
                <Text style={styles.instructionText}>Enable Bluetooth on your phone</Text>
              </View>
              <View style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepText}>4</Text>
                </View>
                <Text style={styles.instructionText}>Press "Scan for OBD Devices"</Text>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1 },
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  content: { flex: 1, padding: 20 },

  // Status
  statusBar: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#8B0000',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusText: { color: '#1F2937', fontSize: 14, fontWeight: '500' },

  // Scan Button
  scanButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  scanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Device Card
  deviceCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deviceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B000015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  deviceId: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  deviceRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  deviceRssi: { fontSize: 11, fontWeight: '500' },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 30,
  },

  // Instructions
  instructionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  instructionCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#8B0000',
  },
  instructionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8B0000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructionText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },

  // Connected
  connectedContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  connectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
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
  connectedCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  connectedIconCircle: {
    marginBottom: 16,
  },
  connectedText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 6,
  },
  deviceNameText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  liveDataButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  liveDataGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  liveDataButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B0000',
  },
});