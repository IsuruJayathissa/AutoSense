import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, PermissionsAndroid,
  Platform
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import OBDService from '../services/OBDService';

const manager = new BleManager();

export default function OBDConnectionScreen({ navigation }) {
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [status, setStatus] = useState('Ready to scan');

  useEffect(() => {
    return () => {
      manager.destroy();
    };
  }, []);

  // Request Bluetooth permissions
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

  // Start Bluetooth Scan
  const startScan = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 
        'Bluetooth permissions are required');
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

    // Stop scan after 10 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setScanning(false);
      setStatus('Scan complete');
    }, 10000);
  };

  // Connect to OBD Device
  const connectToDevice = async (device) => {
    try {
      manager.stopDeviceScan();
      setScanning(false);
      setStatus(`Connecting to ${device.name}...`);

      const success = await OBDService.connect(device.id);

      if (success) {
        setConnectedDevice(device);
        setConnected(true);
        setStatus('Connected!');
        
        // Navigate with connected flag
        navigation.navigate('Dashboard', { isConnected: true });
      } else {
        Alert.alert('Connection Failed', 'Could not initialize OBD');
        setStatus('Connection failed');
      }
    } catch (error) {
      Alert.alert('Connection Failed', error.message);
      setStatus('Connection failed');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔌 OBD-II Connection</Text>
        <View style={{width: 50}} />
      </View>

      {connected ? (
        // Connected State
        <View style={styles.connectedContainer}>
          <Text style={styles.connectedIcon}>✅</Text>
          <Text style={styles.connectedText}>Connected!</Text>
          <Text style={styles.deviceNameText}>
            {connectedDevice?.name}
          </Text>
          <TouchableOpacity
            style={styles.liveDataButton}
            onPress={() => navigation.navigate('Dashboard', 
              { isConnected: true })}
          >
            <Text style={styles.liveDataButtonText}>
              View Live Data →
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Scanning State
        <View style={styles.content}>
          {/* Status */}
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>📡 {status}</Text>
          </View>

          {/* Scan Button */}
          <TouchableOpacity
            style={[styles.scanButton, scanning && styles.scanningButton]}
            onPress={startScan}
            disabled={scanning}
          >
            {scanning ? (
              <View style={styles.scanningContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.scanButtonText}>
                  Scanning...
                </Text>
              </View>
            ) : (
              <Text style={styles.scanButtonText}>
                🔍 Scan for OBD Devices
              </Text>
            )}
          </TouchableOpacity>

          {/* Device List */}
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceCard}
                onPress={() => connectToDevice(item)}
              >
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceIcon}>📡</Text>
                  <View>
                    <Text style={styles.deviceName}>
                      {item.name || 'Unknown Device'}
                    </Text>
                    <Text style={styles.deviceId}>{item.id}</Text>
                    <Text style={styles.deviceRssi}>
                      Signal: {item.rssi} dBm
                    </Text>
                  </View>
                </View>
                <Text style={styles.connectArrow}>→</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {!scanning ? (
                  <>
                    <Text style={styles.emptyIcon}>📵</Text>
                    <Text style={styles.emptyText}>
                      No devices found
                    </Text>
                    <Text style={styles.emptySubtext}>
                      Make sure ELM327 is plugged into your car's 
                      OBD-II port and powered on
                    </Text>
                  </>
                ) : (
                  <Text style={styles.emptyText}>
                    Searching for devices...
                  </Text>
                )}
              </View>
            }
          />

          {/* Instructions */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>
              📋 Before Scanning:
            </Text>
            <Text style={styles.instructionText}>
              1. Plug ELM327 into car's OBD-II port
            </Text>
            <Text style={styles.instructionText}>
              2. Turn car ignition ON
            </Text>
            <Text style={styles.instructionText}>
              3. Enable Bluetooth on your phone
            </Text>
            <Text style={styles.instructionText}>
              4. Press "Scan for OBD Devices"
            </Text>
          </View>
        </View>
      )}
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
  },
  backText: { color: '#fff', fontSize: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 15 },
  statusBar: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusText: { color: '#333', fontSize: 14 },
  scanButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
  },
  scanningButton: { backgroundColor: '#5856D6' },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deviceCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceIcon: { fontSize: 30 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deviceId: { fontSize: 11, color: '#999', marginTop: 2 },
  deviceRssi: { fontSize: 11, color: '#666', marginTop: 2 },
  connectArrow: { fontSize: 20, color: '#007AFF', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  instructionCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    elevation: 2,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  connectedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  connectedIcon: { fontSize: 80, marginBottom: 20 },
  connectedText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 10,
  },
  deviceNameText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  liveDataButton: {
    backgroundColor: '#34C759',
    padding: 18,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
  },
  liveDataButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});