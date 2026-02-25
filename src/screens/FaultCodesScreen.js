import React, { useState } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, FlatList
} from 'react-native';

const sampleFaults = [
  {
    id: '1', code: 'P0301',
    description: 'Cylinder 1 Misfire Detected',
    severity: 'Critical',
    cause: 'Faulty spark plug or ignition coil',
  },
  {
    id: '2', code: 'P0171',
    description: 'System Too Lean (Bank 1)',
    severity: 'Warning',
    cause: 'Vacuum leak or faulty MAF sensor',
  },
  {
    id: '3', code: 'P0420',
    description: 'Catalyst System Efficiency Below Threshold',
    severity: 'Warning',
    cause: 'Failing catalytic converter',
  },
];

export default function FaultCodesScreen({ navigation }) {
  const [faults] = useState(sampleFaults);

  const getSeverityColor = (severity) => {
    if (severity === 'Critical') return '#FF3B30';
    if (severity === 'Warning') return '#FF9500';
    return '#34C759';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>🔍 Fault Codes</Text>
      <Text style={styles.subtitle}>{faults.length} fault(s) detected</Text>

      <FlatList
        data={faults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.faultCard,
            { borderLeftColor: getSeverityColor(item.severity) }]}>
            <View style={styles.faultHeader}>
              <Text style={styles.faultCode}>{item.code}</Text>
              <Text style={[styles.severity,
                { color: getSeverityColor(item.severity) }]}>
                {item.severity}
              </Text>
            </View>
            <Text style={styles.description}>{item.description}</Text>
            <Text style={styles.cause}>⚠️ Cause: {item.cause}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  backButton: { marginBottom: 15 },
  backText: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { color: '#999', marginBottom: 20 },
  faultCard: {
    backgroundColor: '#fff', padding: 15, borderRadius: 10,
    marginBottom: 10, borderLeftWidth: 5, elevation: 2,
  },
  faultHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  faultCode: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  severity: { fontSize: 14, fontWeight: 'bold' },
  description: { fontSize: 14, color: '#333', marginBottom: 5 },
  cause: { fontSize: 12, color: '#666' },
});