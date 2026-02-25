import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView
} from 'react-native';
import OBDService from '../services/OBDService';

export default function DashboardScreen({ navigation, route }) {
  const isConnected = route?.params?.isConnected || false;
  
  const [sensorData, setSensorData] = useState({
    rpm: 0,
    speed: 0,
    coolantTemp: 0,
    throttle: 0,
    fuelLevel: 0,
    engineLoad: 0,
    voltage: 0,
  });
  
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isConnected && OBDService.isConnected) {
      // Start real data polling
      startRealDataPolling();
    } else {
      // Use simulated data
      startSimulation();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isConnected]);

  const startRealDataPolling = () => {
    intervalRef.current = setInterval(async () => {
      const data = await OBDService.getSensorData();
      if (data) {
        setSensorData(data);
      }
    }, 2000);
  };

  const startSimulation = () => {
    intervalRef.current = setInterval(() => {
      setSensorData({
        rpm: Math.floor(Math.random() * 3000) + 800,
        speed: Math.floor(Math.random() * 120),
        coolantTemp: Math.floor(Math.random() * 30) + 75,
        throttle: Math.floor(Math.random() * 100),
        fuelLevel: Math.floor(Math.random() * 40) + 60,
        engineLoad: Math.floor(Math.random() * 60) + 20,
        voltage: (Math.random() * 2 + 12).toFixed(1),
      });
    }, 2000);
  };

  const getStatusColor = (value, min, max) => {
    if (value > max) return '#FF3B30';
    if (value > max * 0.8) return '#FF9500';
    return '#34C759';
  };

  const GaugeCard = ({ icon, value, unit, label, min, max }) => (
    <View style={styles.gaugeCard}>
      <Text style={styles.gaugeIcon}>{icon}</Text>
      <Text style={[styles.gaugeValue, {
        color: getStatusColor(value, min, max)
      }]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={styles.gaugeUnit}>{unit}</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, {
          width: `${Math.min((value / max) * 100, 100)}%`,
          backgroundColor: getStatusColor(value, min, max),
        }]} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Live Dashboard</Text>
        <View style={[styles.badge,
          { backgroundColor: isConnected && OBDService.isConnected 
            ? '#34C759' : '#FF9500' }]}>
          <Text style={styles.badgeText}>
            {isConnected && OBDService.isConnected ? '🔴 LIVE' : '⚡ SIM'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Warning if simulated */}
        {(!isConnected || !OBDService.isConnected) && (
          <TouchableOpacity
            style={styles.simWarning}
            onPress={() => navigation.navigate('OBDConnection')}
          >
            <Text style={styles.simWarningText}>
              ⚠️ Simulated Data - Tap to connect real OBD-II device
            </Text>
          </TouchableOpacity>
        )}

        {/* Gauges */}
        <View style={styles.gaugeGrid}>
          <GaugeCard icon="⚡" value={sensorData.rpm} unit="RPM" 
            label="Engine Speed" min={800} max={6000} />
          <GaugeCard icon="🚗" value={sensorData.speed} unit="km/h" 
            label="Vehicle Speed" min={0} max={200} />
          <GaugeCard icon="🌡️" value={sensorData.coolantTemp} unit="°C" 
            label="Coolant Temp" min={70} max={110} />
          <GaugeCard icon="🎮" value={sensorData.throttle} unit="%" 
            label="Throttle" min={0} max={100} />
          <GaugeCard icon="⛽" value={sensorData.fuelLevel} unit="%" 
            label="Fuel Level" min={10} max={100} />
          <GaugeCard icon="🔧" value={sensorData.engineLoad} unit="%" 
            label="Engine Load" min={0} max={100} />
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusCardTitle}>🚦 Engine Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Overall Condition:</Text>
            <Text style={[styles.statusValue, {
              color: sensorData.coolantTemp > 105 || sensorData.rpm > 5000 
                ? '#FF3B30' : sensorData.coolantTemp > 95 
                ? '#FF9500' : '#34C759'
            }]}>
              {sensorData.coolantTemp > 105 || sensorData.rpm > 5000
                ? '🔴 Critical' : sensorData.coolantTemp > 95
                ? '🟡 Warning' : '🟢 Normal'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Connection:</Text>
            <Text style={[styles.statusValue, {
              color: isConnected && OBDService.isConnected 
                ? '#34C759' : '#FF9500'
            }]}>
              {isConnected && OBDService.isConnected 
                ? '✅ Real OBD-II' : '⚡ Simulated'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Battery Voltage:</Text>
            <Text style={[styles.statusValue, {
              color: sensorData.voltage < 12 ? '#FF9500' : '#34C759'
            }]}>
              {sensorData.voltage}V
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>⚡ Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton}
              onPress={() => navigation.navigate('FaultCodes')}>
              <Text style={styles.actionIcon}>🔍</Text>
              <Text style={styles.actionText}>Scan Faults</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}
              onPress={() => navigation.navigate('EngineHealth')}>
              <Text style={styles.actionIcon}>❤️</Text>
              <Text style={styles.actionText}>Engine Health</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}
              onPress={() => navigation.navigate('History')}>
              <Text style={styles.actionIcon}>📜</Text>
              <Text style={styles.actionText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Styles same as before...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    backgroundColor: '#16213e',
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backText: { color: '#007AFF', fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  content: { padding: 15 },
  simWarning: {
    backgroundColor: '#FF9500',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  simWarningText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gaugeCard: {
    backgroundColor: '#16213e',
    width: '48%',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  gaugeIcon: { fontSize: 28, marginBottom: 5 },
  gaugeValue: { fontSize: 28, fontWeight: 'bold' },
  gaugeUnit: { color: '#888', fontSize: 12, marginTop: 2 },
  gaugeLabel: { color: '#666', fontSize: 11, marginTop: 3 },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#0f3460',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  statusCard: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusLabel: { color: '#888', fontSize: 14 },
  statusValue: { fontSize: 14, fontWeight: 'bold' },
  actionsCard: {
    backgroundColor: '#16213e',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    width: '30%',
  },
  actionIcon: { fontSize: 24, marginBottom: 5 },
  actionText: { color: '#fff', fontSize: 11, textAlign: 'center' },
});
``
