import React, { useState, useEffect } from 'react';
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

export default function EngineHealthScreen({ navigation }) {
  const [healthScore, setHealthScore] = useState(85);
  const [parameters, setParameters] = useState({
    rpm: 800,
    coolantTemp: 90,
    oilPressure: 40,
    battery: 11.8,
    speed: 0,
    throttle: 0,
    fuelLevel: 75,
    engineLoad: 25,
    intakeTemp: 25,
    maf: 2.5,
    timing: 15,
    fuelPressure: 55,
  });

  useEffect(() => {
    if (OBDService.isConnected) {
      const interval = setInterval(async () => {
        const data = await OBDService.getSensorData();
        if (data) {
          setParameters(prev => ({
            ...prev,
            rpm: data.rpm || prev.rpm,
            coolantTemp: data.coolantTemp || prev.coolantTemp,
            battery: data.voltage || prev.battery,
            throttle: data.throttle || prev.throttle,
            fuelLevel: data.fuelLevel || prev.fuelLevel,
            engineLoad: data.engineLoad || prev.engineLoad,
          }));
          calculateHealthScore(data);
        }
      }, 3000);
      return () => clearInterval(interval);
    } else {
      simulateData();
    }
  }, []);

  const simulateData = () => {
    const interval = setInterval(() => {
      setParameters({
        rpm: Math.floor(Math.random() * 1000) + 700,
        coolantTemp: Math.floor(Math.random() * 20) + 85,
        oilPressure: Math.floor(Math.random() * 10) + 35,
        battery: (Math.random() * 1.5 + 11.5).toFixed(1),
        speed: Math.floor(Math.random() * 60),
        throttle: Math.floor(Math.random() * 30),
        fuelLevel: Math.floor(Math.random() * 20) + 70,
        engineLoad: Math.floor(Math.random() * 30) + 20,
        intakeTemp: Math.floor(Math.random() * 10) + 20,
        maf: (Math.random() * 2 + 1.5).toFixed(1),
        timing: Math.floor(Math.random() * 5) + 12,
        fuelPressure: Math.floor(Math.random() * 10) + 50,
      });
    }, 2000);
    return () => clearInterval(interval);
  };

  const calculateHealthScore = (data) => {
    let score = 100;
    if (data.coolantTemp > 100) score -= 15;
    else if (data.coolantTemp > 95) score -= 5;
    if (data.rpm > 5000) score -= 10;
    if (parameters.oilPressure < 20) score -= 20;
    if (data.voltage < 11.5) score -= 10;
    if (data.engineLoad > 80) score -= 5;
    setHealthScore(Math.max(score, 0));
  };

  const getStatus = (param, value) => {
    const ranges = {
      rpm: { min: 700, max: 4000, warning: 4500 },
      coolantTemp: { min: 70, max: 95, warning: 100 },
      oilPressure: { min: 20, max: 60, warning: 15 },
      battery: { min: 11.8, max: 14.5, warning: 11.5 },
      speed: { min: 0, max: 120, warning: 140 },
      throttle: { min: 0, max: 80, warning: 90 },
      fuelLevel: { min: 15, max: 100, warning: 10 },
      engineLoad: { min: 0, max: 70, warning: 85 },
      intakeTemp: { min: 15, max: 40, warning: 50 },
      maf: { min: 1, max: 5, warning: 6 },
      timing: { min: 10, max: 20, warning: 25 },
      fuelPressure: { min: 40, max: 70, warning: 30 },
    };

    const range = ranges[param];
    if (!range) return { status: 'Normal', color: '#10B981' };

    const numValue = parseFloat(value);
    
    if (numValue <= range.warning || numValue >= (range.warning * 2)) {
      return { status: 'Critical', color: '#EF4444' };
    } else if (numValue < range.min || numValue > range.max) {
      return { status: 'Warning', color: '#F59E0B' };
    }
    return { status: 'Normal', color: '#10B981' };
  };

  const getHealthColor = () => {
    if (healthScore >= 80) return '#10B981';
    if (healthScore >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getHealthStatus = () => {
    if (healthScore >= 80) return 'Excellent';
    if (healthScore >= 60) return 'Warning';
    return 'Critical';
  };

  const ParameterRow = ({ label, value, unit, param }) => {
    const { status, color } = getStatus(param, value);
    return (
      <View style={styles.paramRow}>
        <Text style={styles.paramLabel}>{label}</Text>
        <Text style={styles.paramValue}>{value}{unit}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.paramStatus, { color }]}>{status}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Dark Background */}
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Engine Health</Text>
          <View style={styles.headerRight}>
            <Ionicons name="heart" size={24} color="#8B0000" />
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Health Score Card */}
          <View style={styles.healthCardWrapper}>
            <LinearGradient
              colors={['#FFFFFF', '#F9FAFB']}
              style={styles.healthCard}
            >
              <View style={[styles.healthCardBorder, { backgroundColor: getHealthColor() }]} />
              
              <View style={styles.healthHeader}>
                <View style={styles.healthIconCircle}>
                  <LinearGradient
                    colors={[getHealthColor(), getHealthColor() + '80']}
                    style={styles.healthIconGradient}
                  >
                    <Ionicons name="heart" size={32} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <View style={styles.healthInfo}>
                  <Text style={styles.healthLabel}>Engine Health Status</Text>
                  <Text style={[styles.healthStatus, { color: getHealthColor() }]}>
                    {getHealthStatus()}
                  </Text>
                </View>
              </View>

              <View style={styles.scoreContainer}>
                <Text style={[styles.healthScore, { color: getHealthColor() }]}>
                  {healthScore}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>

              {/* Progress Ring */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={[getHealthColor(), getHealthColor() + '80']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${healthScore}%` }]}
                  />
                </View>
                <Text style={styles.progressLabel}>Health Score</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Parameters Grid */}
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#8B0000" />
            <Text style={styles.sectionTitle}>Live Parameters</Text>
          </View>

          {/* Engine Performance */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>
              <Ionicons name="speedometer" size={16} color="#8B0000" /> Engine Performance
            </Text>
            <ParameterRow label="Engine RPM" value={parameters.rpm} unit="" param="rpm" />
            <ParameterRow label="Engine Load" value={parameters.engineLoad} unit="%" param="engineLoad" />
            <ParameterRow label="Throttle Position" value={parameters.throttle} unit="%" param="throttle" />
            <ParameterRow label="Vehicle Speed" value={parameters.speed} unit=" km/h" param="speed" />
          </View>

          {/* Temperature & Cooling */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>
              <Ionicons name="thermometer" size={16} color="#8B0000" /> Temperature & Cooling
            </Text>
            <ParameterRow label="Coolant Temperature" value={parameters.coolantTemp} unit="°C" param="coolantTemp" />
            <ParameterRow label="Intake Air Temp" value={parameters.intakeTemp} unit="°C" param="intakeTemp" />
          </View>

          {/* Fuel System */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>
              <Ionicons name="water" size={16} color="#8B0000" /> Fuel System
            </Text>
            <ParameterRow label="Fuel Level" value={parameters.fuelLevel} unit="%" param="fuelLevel" />
            <ParameterRow label="Fuel Pressure" value={parameters.fuelPressure} unit=" PSI" param="fuelPressure" />
            <ParameterRow label="MAF Sensor" value={parameters.maf} unit=" g/s" param="maf" />
          </View>

          {/* Electrical & Others */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>
              <Ionicons name="flash" size={16} color="#8B0000" /> Electrical & Others
            </Text>
            <ParameterRow label="Battery Voltage" value={parameters.battery} unit="V" param="battery" />
            <ParameterRow label="Oil Pressure" value={parameters.oilPressure} unit=" PSI" param="oilPressure" />
            <ParameterRow label="Ignition Timing" value={parameters.timing} unit="°" param="timing" />
          </View>

          {/* Recommendations */}
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={20} color="#8B0000" />
            <Text style={styles.sectionTitle}>Recommendations</Text>
          </View>

          <View style={styles.recommendCard}>
            <View style={styles.recommendCardBorder} />
            {healthScore < 80 ? (
              <>
                {parameters.coolantTemp > 95 && (
                  <View style={styles.recommendRow}>
                    <Ionicons name="warning" size={18} color="#F59E0B" />
                    <Text style={styles.recommendText}>
                      Check cooling system - temperature high
                    </Text>
                  </View>
                )}
                {parameters.battery < 12 && (
                  <View style={styles.recommendRow}>
                    <Ionicons name="warning" size={18} color="#F59E0B" />
                    <Text style={styles.recommendText}>
                      Battery voltage low - check alternator
                    </Text>
                  </View>
                )}
                {parameters.oilPressure < 25 && (
                  <View style={styles.recommendRow}>
                    <Ionicons name="warning" size={18} color="#EF4444" />
                    <Text style={styles.recommendText}>
                      Oil pressure low - check oil level
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.recommendRow}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.recommendText, { color: '#10B981' }]}>
                  All systems operating normally
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('FaultCodes')}
            >
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                style={styles.actionGradient}
              >
                <Ionicons name="search" size={28} color="#FFFFFF" />
                <Text style={styles.actionText}>Fault Codes</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <LinearGradient
                colors={['#6B0000', '#8B0000']}
                style={styles.actionGradient}
              >
                <Ionicons name="stats-chart" size={28} color="#FFFFFF" />
                <Text style={styles.actionText}>Live Data</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Health Card
  healthCardWrapper: {
    marginBottom: 24,
  },
  healthCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  healthCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  healthIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginRight: 16,
  },
  healthIconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthInfo: {
    flex: 1,
  },
  healthLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  healthStatus: {
    fontSize: 20,
    fontWeight: '700',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  healthScore: {
    fontSize: 64,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 24,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  },

  // Parameter Cards
  paramCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  paramCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#8B0000',
  },
  paramCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  paramLabel: {
    flex: 2,
    color: '#1F2937',
    fontSize: 14,
  },
  paramValue: {
    flex: 1,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  paramStatus: {
    fontWeight: '600',
    fontSize: 12,
  },

  // Recommendations
  recommendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  recommendCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#8B0000',
  },
  recommendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  recommendText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },

  // Action Cards
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});