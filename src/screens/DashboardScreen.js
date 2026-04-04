import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OBDService from '../services/OBDService';

export default function DashboardScreen({ navigation }) {
  const [obdConnected, setObdConnected] = useState(OBDService.isConnected);

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
    const unsubscribe = OBDService.onConnectionChange((connected) => {
      setObdConnected(connected);
      if (connected) {
        startRealDataPolling();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });

    if (OBDService.isConnected) startRealDataPolling();

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startRealDataPolling = () => {
    intervalRef.current = setInterval(async () => {
      const data = await OBDService.getSensorData();
      if (data) {
        setSensorData(data);
      }
    }, 2000);
  };


  const getStatusColor = (value, min, max) => {
    if (value > max) return '#EF4444';
    if (value > max * 0.8) return '#F59E0B';
    return '#10B981';
  };

  const GaugeCard = ({ icon, value, unit, label, min, max }) => {
    const statusColor = getStatusColor(value, min, max);
    const percentage = Math.min((value / max) * 100, 100);
    
    return (
      <View style={styles.gaugeCard}>
        <View style={[styles.gaugeCardBorder, { backgroundColor: statusColor }]} />
        
        <View style={[styles.gaugeIconCircle, { borderColor: statusColor + '30' }]}>
          <Ionicons name={icon} size={24} color="#1F2937" />
        </View>
        
        <Text style={[styles.gaugeValue, { color: statusColor }]}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        <Text style={styles.gaugeUnit}>{unit}</Text>
        <Text style={styles.gaugeLabel}>{label}</Text>
        
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { 
            width: `${percentage}%`,
            backgroundColor: statusColor 
          }]} />
        </View>
      </View>
    );
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
          
          <Text style={styles.headerTitle}>Live Dashboard</Text>
          
          <View style={[styles.statusBadge, {
            backgroundColor: obdConnected ? '#10B981' : '#F59E0B'
          }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>
              {obdConnected ? 'LIVE' : 'SIM'}
            </Text>
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Connection Warning */}
          {(!obdConnected) && (
            <TouchableOpacity
              style={styles.warningCard}
              onPress={() => navigation.navigate('OBDConnection')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.warningGradient}
              >
                <Ionicons name="warning" size={24} color="#FFFFFF" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Simulated Data Active</Text>
                  <Text style={styles.warningSubtitle}>Tap to connect real OBD-II device</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Real-time Indicator */}
          <View style={styles.sectionHeader}>
            <Ionicons name="pulse" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Real-time Sensors</Text>
            {(obdConnected) && (
              <View style={styles.liveIndicator} />
            )}
          </View>

          {/* Gauges Grid */}
          <View style={styles.gaugeGrid}>
            <GaugeCard 
              icon="speedometer" 
              value={sensorData.rpm} 
              unit="RPM" 
              label="Engine Speed" 
              min={800} 
              max={6000} 
            />
            <GaugeCard 
              icon="thermometer" 
              value={sensorData.coolantTemp} 
              unit="°C" 
              label="Coolant Temp" 
              min={70} 
              max={110} 
            />
            <GaugeCard 
              icon="speedometer-outline" 
              value={sensorData.throttle} 
              unit="%" 
              label="Throttle" 
              min={0} 
              max={100} 
            />
            <GaugeCard 
              icon="construct" 
              value={sensorData.engineLoad} 
              unit="%" 
              label="Engine Load" 
              min={0} 
              max={100} 
            />
          </View>

          {/* Engine Status Card */}
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Engine Status</Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusCardBorder} />
            
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Ionicons name="heart" size={20} color="#1F2937" />
                <Text style={styles.statusLabel}>Overall Condition</Text>
              </View>
              <View style={[styles.statusValueBadge, {
                backgroundColor: (sensorData.coolantTemp > 105 || sensorData.rpm > 5000) 
                  ? '#EF4444' 
                  : sensorData.coolantTemp > 95 
                  ? '#F59E0B' 
                  : '#10B981'
              }]}>
                <Text style={styles.statusValueText}>
                  {sensorData.coolantTemp > 105 || sensorData.rpm > 5000
                    ? 'Critical' 
                    : sensorData.coolantTemp > 95
                    ? 'Warning' 
                    : 'Normal'}
                </Text>
              </View>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Ionicons name="bluetooth" size={20} color="#1F2937" />
                <Text style={styles.statusLabel}>Connection</Text>
              </View>
              <View style={[styles.statusValueBadge, {
                backgroundColor: obdConnected ? '#10B981' : '#F59E0B'
              }]}>
                <Text style={styles.statusValueText}>
                  {obdConnected ? 'Real OBD-II' : 'Simulated'}
                </Text>
              </View>
            </View>

            <View style={styles.statusDivider} />

            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <Ionicons name="battery-half" size={20} color="#1F2937" />
                <Text style={styles.statusLabel}>Battery Voltage</Text>
              </View>
              <View style={[styles.statusValueBadge, {
                backgroundColor: sensorData.voltage < 12 ? '#F59E0B' : '#10B981'
              }]}>
                <Text style={styles.statusValueText}>{sensorData.voltage}V</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('FaultCodes')}
            >
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                style={styles.actionGradient}
              >
                <Ionicons name="search" size={28} color="#FFFFFF" />
                <Text style={styles.actionText}>Scan Faults</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('EngineHealth')}
            >
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                style={styles.actionGradient}
              >
                <Ionicons name="heart" size={28} color="#FFFFFF" />
                <Text style={styles.actionText}>Engine Health</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('History')}
            >
              <LinearGradient
                colors={['#6B0000', '#8B0000']}
                style={styles.actionGradient}
              >
                <Ionicons name="time" size={28} color="#FFFFFF" />
                <Text style={styles.actionText}>History</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('DataCharts')}
            >
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                style={styles.actionGradient}
              >
                <Ionicons name="analytics" size={28} color="#FFFFFF" />
                <Text style={styles.actionText}>View Charts</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

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
  safeArea: {
    flex: 1,
  },
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Warning Card
  warningCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Gauge Grid
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gaugeCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
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
  gaugeCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  gaugeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gaugeValue: {
    fontSize: 32,
    fontWeight: '800',
  },
  gaugeUnit: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  gaugeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Status Card
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
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
  statusCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#1F2937',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  statusValueBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  // Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});