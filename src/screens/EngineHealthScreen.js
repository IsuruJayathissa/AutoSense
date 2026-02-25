import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, ScrollView
} from 'react-native';
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
    // If OBD connected, fetch real data
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
          
          // Calculate health score
          calculateHealthScore(data);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    } else {
      // Use simulated data
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
    
    // Deduct points for abnormal values
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
    if (!range) return { status: 'Normal', color: '#34C759' };

    const numValue = parseFloat(value);
    
    if (numValue <= range.warning || numValue >= (range.warning * 2)) {
      return { status: 'Critical', color: '#FF3B30' };
    } else if (numValue < range.min || numValue > range.max) {
      return { status: 'Warning', color: '#FF9500' };
    }
    return { status: 'Normal', color: '#34C759' };
  };

  const getHealthColor = () => {
    if (healthScore >= 80) return '#34C759';
    if (healthScore >= 60) return '#FF9500';
    return '#FF3B30';
  };

  const getHealthStatus = () => {
    if (healthScore >= 80) return '✅ Normal';
    if (healthScore >= 60) return '⚠️ Warning';
    return '🔴 Critical';
  };

  const ParameterRow = ({ label, value, unit, param }) => {
    const { status, color } = getStatus(param, value);
    return (
      <View style={styles.paramRow}>
        <Text style={styles.paramLabel}>{label}</Text>
        <Text style={styles.paramValue}>{value}{unit}</Text>
        <Text style={[styles.paramStatus, { color }]}>{status}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>❤️ Engine Health</Text>
        <View style={{width: 50}} />
      </View>

      <ScrollView style={styles.content}>
        {/* Health Score Card */}
        <View style={styles.healthCard}>
          <Text style={[styles.healthStatus, { color: getHealthColor() }]}>
            {getHealthStatus()}
          </Text>
          <Text style={[styles.healthScore, { color: getHealthColor() }]}>
            {healthScore}/100
          </Text>
          <Text style={styles.healthLabel}>Engine Health Score</Text>
          
          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${healthScore}%`,
              backgroundColor: getHealthColor()
            }]} />
          </View>
        </View>

        {/* Parameters Status */}
        <View style={styles.paramCard}>
          <Text style={styles.paramTitle}>📊 Parameters Status</Text>
          
          <View style={styles.paramSection}>
            <Text style={styles.sectionTitle}>Engine Performance</Text>
            <ParameterRow 
              label="Engine RPM" 
              value={parameters.rpm} 
              unit="" 
              param="rpm" 
            />
            <ParameterRow 
              label="Engine Load" 
              value={parameters.engineLoad} 
              unit="%" 
              param="engineLoad" 
            />
            <ParameterRow 
              label="Throttle Position" 
              value={parameters.throttle} 
              unit="%" 
              param="throttle" 
            />
            <ParameterRow 
              label="Vehicle Speed" 
              value={parameters.speed} 
              unit=" km/h" 
              param="speed" 
            />
          </View>

          <View style={styles.paramSection}>
            <Text style={styles.sectionTitle}>Temperature & Cooling</Text>
            <ParameterRow 
              label="Coolant Temperature" 
              value={parameters.coolantTemp} 
              unit="°C" 
              param="coolantTemp" 
            />
            <ParameterRow 
              label="Intake Air Temp" 
              value={parameters.intakeTemp} 
              unit="°C" 
              param="intakeTemp" 
            />
          </View>

          <View style={styles.paramSection}>
            <Text style={styles.sectionTitle}>Fuel System</Text>
            <ParameterRow 
              label="Fuel Level" 
              value={parameters.fuelLevel} 
              unit="%" 
              param="fuelLevel" 
            />
            <ParameterRow 
              label="Fuel Pressure" 
              value={parameters.fuelPressure} 
              unit=" PSI" 
              param="fuelPressure" 
            />
            <ParameterRow 
              label="MAF Sensor" 
              value={parameters.maf} 
              unit=" g/s" 
              param="maf" 
            />
          </View>

          <View style={styles.paramSection}>
            <Text style={styles.sectionTitle}>Electrical & Others</Text>
            <ParameterRow 
              label="Battery Voltage" 
              value={parameters.battery} 
              unit="V" 
              param="battery" 
            />
            <ParameterRow 
              label="Oil Pressure" 
              value={parameters.oilPressure} 
              unit=" PSI" 
              param="oilPressure" 
            />
            <ParameterRow 
              label="Ignition Timing" 
              value={parameters.timing} 
              unit="°" 
              param="timing" 
            />
          </View>
        </View>

        {/* Recommendations */}
        <View style={styles.recommendCard}>
          <Text style={styles.recommendTitle}>💡 Recommendations</Text>
          {healthScore < 80 && (
            <>
              {parameters.coolantTemp > 95 && (
                <Text style={styles.recommendText}>
                  • Check cooling system - temperature high
                </Text>
              )}
              {parameters.battery < 12 && (
                <Text style={styles.recommendText}>
                  • Battery voltage low - check alternator
                </Text>
              )}
              {parameters.oilPressure < 25 && (
                <Text style={styles.recommendText}>
                  • Oil pressure low - check oil level
                </Text>
              )}
            </>
          )}
          {healthScore >= 80 && (
            <Text style={styles.recommendText}>
              ✅ All systems operating normally
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('FaultCodes')}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <Text style={styles.actionText}>Check Fault Codes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionText}>View Live Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#34C759',
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backText: { color: '#fff', fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { flex: 1, padding: 15 },
  
  // Health Card
  healthCard: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
  },
  healthStatus: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  healthScore: { fontSize: 56, fontWeight: 'bold' },
  healthLabel: { color: '#666', marginTop: 5, fontSize: 14 },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  // Parameters
  paramCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
  },
  paramTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  paramSection: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paramLabel: { flex: 2, color: '#333', fontSize: 14 },
  paramValue: { flex: 1, textAlign: 'center', color: '#666', fontSize: 14 },
  paramStatus: { flex: 1, textAlign: 'right', fontWeight: '600', fontSize: 14 },

  // Recommendations
  recommendCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
  },
  recommendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  recommendText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },

  // Actions
  actionsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#fff',
    width: '48%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
  },
  actionIcon: { fontSize: 32, marginBottom: 8 },
  actionText: { fontSize: 13, color: '#333', textAlign: 'center' },
});