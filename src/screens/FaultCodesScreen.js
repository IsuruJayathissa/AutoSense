import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, FlatList,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import OBDService from '../services/OBDService';
import { getCodeInfo, getSeverityColor } from '../services/FaultCodeDatabase';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function FaultCodesScreen({ navigation }) {
  const [faults, setFaults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [vehicleBrand, setVehicleBrand] = useState(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadVehicleBrand();
  }, []);

  const loadVehicleBrand = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userVehicleDoc = await getDoc(doc(db, 'userVehicles', userId));
      if (userVehicleDoc.exists()) {
        const vehicleId = userVehicleDoc.data().vehicleId;
        const vehicleDoc = await getDoc(doc(db, 'vehicles', vehicleId));
        if (vehicleDoc.exists()) {
          setVehicleBrand(vehicleDoc.data().brand);
        }
      }
    } catch (error) {
      console.warn('Error loading vehicle brand:', error);
    }
  };

  const scanFaultCodes = async () => {
    if (!OBDService.isConnected) {
      // Use sample data when not connected
      setScanning(true);
      await new Promise(r => setTimeout(r, 2000));
      const sampleCodes = ['P0301', 'P0171', 'P0420'];
      const results = sampleCodes.map(code => {
        const info = getCodeInfo(code, vehicleBrand);
        return { id: code, ...info };
      });
      setFaults(results);
      setScanning(false);
      setScanned(true);
      return;
    }

    setScanning(true);
    setFaults([]);
    try {
      const codes = await OBDService.getFaultCodes();
      if (codes.length === 0) {
        setFaults([]);
      } else {
        const results = codes.map(code => {
          const info = getCodeInfo(code, vehicleBrand);
          return { id: code, ...info };
        });
        setFaults(results);
      }
    } catch (error) {
      Alert.alert('Scan Error', 'Failed to read fault codes: ' + error.message);
    } finally {
      setScanning(false);
      setScanned(true);
    }
  };

  const clearFaultCodes = async () => {
    if (!OBDService.isConnected) {
      Alert.alert('Not Connected', 'Connect to OBD-II device to clear fault codes.');
      return;
    }

    Alert.alert(
      'Clear Fault Codes',
      'This will clear all stored diagnostic trouble codes. The check engine light will turn off. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              const success = await OBDService.clearFaultCodes();
              if (success) {
                setFaults([]);
                setScanned(false);
                Alert.alert('Success', 'Fault codes cleared successfully!');
              } else {
                Alert.alert('Error', 'Failed to clear fault codes.');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setClearing(false);
            }
          },
        },
      ]
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
          <Text style={styles.headerTitle}>Fault Codes</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: OBDService.isConnected ? '#10B981' : '#F59E0B'
          }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>
              {OBDService.isConnected ? 'LIVE' : 'SIM'}
            </Text>
          </View>
        </View>

        {/* Brand Info */}
        {vehicleBrand && (
          <View style={styles.brandBanner}>
            <Ionicons name="car-sport" size={18} color="#8B0000" />
            <Text style={styles.brandText}>Vehicle: {vehicleBrand}</Text>
          </View>
        )}

        {/* Scan Button */}
        <View style={styles.scanSection}>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={scanFaultCodes}
            disabled={scanning}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#8B0000', '#A00000']}
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
                  <Text style={styles.scanButtonText}>Scan for Fault Codes</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {faults.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearFaultCodes}
              disabled={clearing}
              activeOpacity={0.8}
            >
              {clearing ? (
                <ActivityIndicator color="#8B0000" size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#8B0000" />
                  <Text style={styles.clearButtonText}>Clear Codes</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {scanned && (
          <View style={styles.resultsBanner}>
            <Text style={styles.resultsText}>
              {faults.length === 0
                ? '✅ No fault codes detected'
                : `⚠️ ${faults.length} fault code(s) found`}
            </Text>
          </View>
        )}

        <FlatList
          data={faults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const severityColor = getSeverityColor(item.severity);
            return (
              <View style={[styles.faultCard, { borderLeftColor: severityColor }]}>
                <View style={styles.faultHeader}>
                  <View style={styles.faultCodeBadge}>
                    <Text style={styles.faultCode}>{item.code}</Text>
                  </View>
                  <View style={[styles.severityBadge, {
                    backgroundColor: severityColor + '20',
                    borderColor: severityColor,
                  }]}>
                    <Text style={[styles.severity, { color: severityColor }]}>
                      {item.severity}
                    </Text>
                  </View>
                </View>
                <Text style={styles.description}>{item.description}</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="warning-outline" size={14} color="#6B7280" />
                  <Text style={styles.cause}>Cause: {item.cause}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="construct-outline" size={14} color="#6B7280" />
                  <Text style={styles.cause}>Fix: {item.fix}</Text>
                </View>
                {item.brand && item.brand !== 'Unknown' && (
                  <View style={styles.brandTag}>
                    <Text style={styles.brandTagText}>{item.brand}</Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            !scanning && scanned ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
                <Text style={styles.emptyTitle}>All Clear!</Text>
                <Text style={styles.emptySubtext}>
                  No diagnostic trouble codes were found.
                </Text>
              </View>
            ) : !scanned ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Ready to Scan</Text>
                <Text style={styles.emptySubtext}>
                  Tap "Scan for Fault Codes" to read diagnostic data from your vehicle.
                </Text>
              </View>
            ) : null
          }
        />
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
  brandBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  brandText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B0000',
  },
  scanSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scanGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  scanningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#8B0000',
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    color: '#8B0000',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsBanner: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  faultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  faultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  faultCodeBadge: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  faultCode: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  severity: {
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    marginBottom: 10,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  cause: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  brandTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#8B000015',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  brandTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B0000',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
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
    paddingHorizontal: 40,
  },
});