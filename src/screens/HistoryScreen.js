import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';

const sampleHistory = [
  { id: '1', date: '2026-02-17', faults: 2, status: 'Warning', mileage: '45,230 km' },
  { id: '2', date: '2026-02-16', faults: 0, status: 'Normal', mileage: '45,180 km' },
  { id: '3', date: '2026-02-15', faults: 1, status: 'Warning', mileage: '45,100 km' },
];

export default function HistoryScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>📜 Diagnostic History</Text>

      <FlatList
        data={sampleHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.date}>📅 {item.date}</Text>
              <Text style={[styles.status, {
                color: item.status === 'Normal' ? '#34C759' : '#FF9500'
              }]}>{item.status}</Text>
            </View>
            <Text style={styles.detail}>🔧 Faults: {item.faults}</Text>
            <Text style={styles.detail}>🚗 Mileage: {item.mileage}</Text>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  historyCard: {
    backgroundColor: '#fff', padding: 15, borderRadius: 10,
    marginBottom: 10, elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
  },
  date: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  status: { fontSize: 14, fontWeight: 'bold' },
  detail: { fontSize: 13, color: '#666', marginTop: 3 },
});
