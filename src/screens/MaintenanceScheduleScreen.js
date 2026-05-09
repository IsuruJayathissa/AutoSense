import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl, StatusBar, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import MaintenanceService from '../services/MaintenanceService';

const STATUS_STYLES = {
  overdue:  { color: '#EF4444', bg: '#FEE2E2', label: 'Overdue' },
  due_soon: { color: '#F59E0B', bg: '#FEF3C7', label: 'Due Soon' },
  ok:       { color: '#10B981', bg: '#D1FAE5', label: 'OK' },
};

export default function MaintenanceScheduleScreen({ navigation }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [engineType, setEngineType] = useState('Diesel');
  const [mileageModalOpen, setMileageModalOpen] = useState(false);
  const [mileageInput, setMileageInput] = useState('');

  const load = useCallback(async () => {
    try {
      // Pull engine type from vehicle profile so intervals match
      const userId = auth.currentUser?.uid;
      let resolvedEngine = 'Diesel';
      if (userId) {
        const userVehicleDoc = await getDoc(doc(db, 'userVehicles', userId));
        if (userVehicleDoc.exists()) {
          const vid = userVehicleDoc.data().vehicleId;
          if (vid) {
            const vDoc = await getDoc(doc(db, 'vehicles', vid));
            if (vDoc.exists() && vDoc.data().engineType) {
              resolvedEngine = vDoc.data().engineType;
            }
          }
        }
      }
      setEngineType(resolvedEngine);
      const data = await MaintenanceService.getSchedule(resolvedEngine);
      setSchedule(data);
    } catch (e) {
      console.error('Maintenance load error:', e);
      Alert.alert('Error', 'Could not load maintenance schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const onUpdateMileage = async () => {
    const km = parseInt(mileageInput.replace(/[^\d]/g, ''), 10);
    if (!km || km <= 0) {
      Alert.alert('Invalid', 'Enter a valid mileage in km.');
      return;
    }
    if (schedule?.currentMileage && km < schedule.currentMileage) {
      Alert.alert(
        'Mileage Lower',
        `Current is ${schedule.currentMileage.toLocaleString()} km. Mileage cannot go down.`
      );
      return;
    }
    await MaintenanceService.updateMileage(km);
    setMileageModalOpen(false);
    setMileageInput('');
    load();
  };

  const onMarkServiced = (item) => {
    Alert.alert(
      `Mark Serviced: ${item.name}`,
      `Record this item as serviced at ${schedule.currentMileage.toLocaleString()} km? The next service will be due at ${(schedule.currentMileage + item.intervalKm).toLocaleString()} km.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Serviced',
          onPress: async () => {
            await MaintenanceService.markServiced(item.key);
            load();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#8B0000" />
        <Text style={styles.loadingText}>Loading schedule...</Text>
      </View>
    );
  }

  const overdueCount = schedule?.items.filter(i => i.status === 'overdue').length || 0;
  const dueSoonCount = schedule?.items.filter(i => i.status === 'due_soon').length || 0;

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
          <Text style={styles.headerTitle}>Maintenance Schedule</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B0000" />
          }
        >
          {/* Mileage card */}
          <View style={styles.mileageCard}>
            <LinearGradient
              colors={['#8B0000', '#A00000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.mileageCardBorder}
            />
            <View style={styles.mileageRow}>
              <View style={styles.mileageIconCircle}>
                <Ionicons name="speedometer" size={28} color="#8B0000" />
              </View>
              <View style={styles.mileageInfo}>
                <Text style={styles.mileageLabel}>Current Mileage</Text>
                <Text style={styles.mileageValue}>
                  {(schedule?.currentMileage || 0).toLocaleString()} <Text style={styles.mileageUnit}>km</Text>
                </Text>
                <Text style={styles.mileageNote}>
                  Auto-updates from inspection odometer reading
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.updateMileageBtn}
              onPress={() => {
                setMileageInput(String(schedule?.currentMileage || ''));
                setMileageModalOpen(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color="#8B0000" />
              <Text style={styles.updateMileageBtnText}>Update Manually</Text>
            </TouchableOpacity>
          </View>

          {/* Summary banners */}
          {(overdueCount > 0 || dueSoonCount > 0) && (
            <View style={styles.summaryRow}>
              {overdueCount > 0 && (
                <View style={[styles.summaryPill, { backgroundColor: STATUS_STYLES.overdue.bg }]}>
                  <Ionicons name="alert-circle" size={16} color={STATUS_STYLES.overdue.color} />
                  <Text style={[styles.summaryPillText, { color: STATUS_STYLES.overdue.color }]}>
                    {overdueCount} Overdue
                  </Text>
                </View>
              )}
              {dueSoonCount > 0 && (
                <View style={[styles.summaryPill, { backgroundColor: STATUS_STYLES.due_soon.bg }]}>
                  <Ionicons name="time" size={16} color={STATUS_STYLES.due_soon.color} />
                  <Text style={[styles.summaryPillText, { color: STATUS_STYLES.due_soon.color }]}>
                    {dueSoonCount} Due Soon
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Items list */}
          <View style={styles.sectionHeader}>
            <Ionicons name="construct" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Service Items</Text>
            <Text style={styles.sectionNote}>{engineType}</Text>
          </View>

          {schedule?.items.map((item) => {
            const sty = STATUS_STYLES[item.status];
            const progressPct = Math.min(
              100,
              Math.max(0, ((item.intervalKm - item.kmUntilDue) / item.intervalKm) * 100)
            );
            return (
              <View key={item.key} style={[styles.itemCard, { borderLeftColor: sty.color }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconCircle, { backgroundColor: sty.color + '20' }]}>
                    <Ionicons name={item.icon} size={22} color={sty.color} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemInterval}>
                      Every {item.intervalKm.toLocaleString()} km
                    </Text>
                  </View>
                  <View style={[styles.itemBadge, { backgroundColor: sty.bg }]}>
                    <Text style={[styles.itemBadgeText, { color: sty.color }]}>
                      {sty.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemProgressBar}>
                  <View style={[
                    styles.itemProgressFill,
                    { width: `${progressPct}%`, backgroundColor: sty.color },
                  ]} />
                </View>

                <View style={styles.itemDetails}>
                  <View>
                    <Text style={styles.itemDetailLabel}>Last Service</Text>
                    <Text style={styles.itemDetailValue}>
                      {item.lastServiceKm.toLocaleString()} km
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.itemDetailLabel}>Next Due</Text>
                    <Text style={styles.itemDetailValue}>
                      {item.nextDueKm.toLocaleString()} km
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.itemDetailLabel}>
                      {item.kmUntilDue >= 0 ? 'Until Due' : 'Overdue By'}
                    </Text>
                    <Text style={[styles.itemDetailValue, { color: sty.color }]}>
                      {Math.abs(item.kmUntilDue).toLocaleString()} km
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.markServicedBtn}
                  onPress={() => onMarkServiced(item)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.markServicedBtnText}>Mark as Serviced</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Update mileage modal */}
      <Modal
        visible={mileageModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMileageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Mileage</Text>
            <Text style={styles.modalSub}>
              Enter the current odometer reading. This will refresh all service due dates.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={mileageInput}
              onChangeText={setMileageInput}
              placeholder="e.g. 145320"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setMileageModalOpen(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={onUpdateMileage}
              >
                <Text style={styles.modalBtnPrimaryText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6B7280', marginTop: 12, fontSize: 14 },

  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  // Mileage card
  mileageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    position: 'relative', overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  mileageCardBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 4,
  },
  mileageRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  mileageIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  mileageInfo: { flex: 1 },
  mileageLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  mileageValue: { fontSize: 28, fontWeight: '800', color: '#1F2937' },
  mileageUnit: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  mileageNote: { fontSize: 11, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },

  updateMileageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FEE2E2', borderRadius: 8,
    marginTop: 12,
  },
  updateMileageBtnText: { color: '#8B0000', fontSize: 12, fontWeight: '700' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12,
  },
  summaryPillText: { fontSize: 13, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 12, marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  sectionNote: { fontSize: 12, color: '#9CA3AF' },

  // Item card
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14,
    marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  itemInterval: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  itemBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  itemBadgeText: { fontSize: 11, fontWeight: '700' },

  itemProgressBar: {
    height: 6, backgroundColor: '#F3F4F6',
    borderRadius: 3, marginTop: 12, overflow: 'hidden',
  },
  itemProgressFill: { height: '100%', borderRadius: 3 },

  itemDetails: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  itemDetailLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  itemDetailValue: { fontSize: 13, fontWeight: '700', color: '#1F2937' },

  markServicedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12,
    backgroundColor: '#8B0000', paddingVertical: 10, borderRadius: 10,
  },
  markServicedBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: '#1F2937', marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnCancel: { backgroundColor: '#F3F4F6' },
  modalBtnCancelText: { color: '#6B7280', fontSize: 14, fontWeight: '700' },
  modalBtnPrimary: { backgroundColor: '#8B0000' },
  modalBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
