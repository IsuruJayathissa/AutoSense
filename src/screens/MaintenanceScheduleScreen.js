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
  const [clearing, setClearing] = useState(false);

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

  // ── Clear all service history (with confirmation) ─────────────────────
  const handleClearAll = () => {
    if (!schedule || !schedule.items?.length) {
      Alert.alert('Nothing to Clear', 'No maintenance records to reset.');
      return;
    }
    Alert.alert(
      'Clear Service History',
      `This will reset every item's last-serviced record to the current mileage (${(schedule.currentMileage || 0).toLocaleString()} km). Everything will read as "just serviced". Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await MaintenanceService.resetServiceHistory();
              await load();
              Alert.alert('Cleared', 'Service history has been reset.');
            } catch (err) {
              Alert.alert('Error', err?.message || 'Could not clear service history.');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
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
          <TouchableOpacity
            onPress={handleClearAll}
            style={styles.clearBtn}
            disabled={clearing || loading}
            activeOpacity={0.7}
          >
            {clearing ? (
              <ActivityIndicator size="small" color="#8B0000" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#8B0000" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B0000" />
          }
        >
          {/* Mileage hero card */}
          <LinearGradient
            colors={['#1F2937', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mileageCard}
          >
            <View style={styles.mileageTopRow}>
              <View style={styles.mileageBadge}>
                <Ionicons name="speedometer" size={14} color="#FCA5A5" />
                <Text style={styles.mileageBadgeText}>Current Mileage</Text>
              </View>
              <View style={styles.mileageEnginePill}>
                <Ionicons name="cog" size={11} color="rgba(255,255,255,0.8)" />
                <Text style={styles.mileageEnginePillText}>{engineType}</Text>
              </View>
            </View>

            <View style={styles.mileageMain}>
              <Text style={styles.mileageValue}>
                {(schedule?.currentMileage || 0).toLocaleString()}
              </Text>
              <Text style={styles.mileageUnit}>km</Text>
            </View>

            <Text style={styles.mileageNote}>
              Auto-updates from inspection odometer reading
            </Text>

            <TouchableOpacity
              style={styles.updateMileageBtn}
              onPress={() => {
                setMileageInput(String(schedule?.currentMileage || ''));
                setMileageModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.updateMileageBtnText}>Update Mileage</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Summary stats — 3 columns */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: '#FECACA' }]}>
              <View style={[styles.statIconChip, { backgroundColor: STATUS_STYLES.overdue.bg }]}>
                <Ionicons name="alert-circle" size={16} color={STATUS_STYLES.overdue.color} />
              </View>
              <Text style={[styles.statValue, { color: STATUS_STYLES.overdue.color }]}>
                {overdueCount}
              </Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
            <View style={[styles.statCard, { borderColor: '#FDE68A' }]}>
              <View style={[styles.statIconChip, { backgroundColor: STATUS_STYLES.due_soon.bg }]}>
                <Ionicons name="time" size={16} color={STATUS_STYLES.due_soon.color} />
              </View>
              <Text style={[styles.statValue, { color: STATUS_STYLES.due_soon.color }]}>
                {dueSoonCount}
              </Text>
              <Text style={styles.statLabel}>Due Soon</Text>
            </View>
            <View style={[styles.statCard, { borderColor: '#A7F3D0' }]}>
              <View style={[styles.statIconChip, { backgroundColor: STATUS_STYLES.ok.bg }]}>
                <Ionicons name="checkmark-circle" size={16} color={STATUS_STYLES.ok.color} />
              </View>
              <Text style={[styles.statValue, { color: STATUS_STYLES.ok.color }]}>
                {(schedule?.items.length || 0) - overdueCount - dueSoonCount}
              </Text>
              <Text style={styles.statLabel}>Up to Date</Text>
            </View>
          </View>

          {/* Items list */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconChip}>
                <Ionicons name="construct" size={16} color="#8B0000" />
              </View>
              <Text style={styles.sectionTitle}>Service Items</Text>
            </View>
            <View style={styles.sectionCountPill}>
              <Text style={styles.sectionCountText}>{schedule?.items.length || 0}</Text>
            </View>
          </View>

          {schedule?.items.map((item) => {
            const sty = STATUS_STYLES[item.status];
            const progressPct = Math.min(
              100,
              Math.max(0, ((item.intervalKm - item.kmUntilDue) / item.intervalKm) * 100)
            );
            return (
              <View key={item.key} style={styles.itemCard}>
                <View style={[styles.itemAccentBar, { backgroundColor: sty.color }]} />

                <View style={styles.itemHeader}>
                  <View style={[styles.itemIconCircle, { backgroundColor: sty.color + '15' }]}>
                    <Ionicons name={item.icon} size={24} color={sty.color} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemInterval}>
                      Every {item.intervalKm.toLocaleString()} km
                    </Text>
                  </View>
                  <View style={[styles.itemBadge, { backgroundColor: sty.bg }]}>
                    <View style={[styles.itemBadgeDot, { backgroundColor: sty.color }]} />
                    <Text style={[styles.itemBadgeText, { color: sty.color }]}>
                      {sty.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemProgressRow}>
                  <View style={styles.itemProgressBar}>
                    <View style={[
                      styles.itemProgressFill,
                      { width: `${progressPct}%`, backgroundColor: sty.color },
                    ]} />
                  </View>
                  <Text style={[styles.itemProgressText, { color: sty.color }]}>
                    {Math.round(progressPct)}%
                  </Text>
                </View>

                <View style={styles.itemDetails}>
                  <View style={styles.itemDetailCol}>
                    <Text style={styles.itemDetailLabel}>Last Service</Text>
                    <Text style={styles.itemDetailValue}>
                      {item.lastServiceKm.toLocaleString()}
                      <Text style={styles.itemDetailUnit}> km</Text>
                    </Text>
                  </View>
                  <View style={styles.itemDetailDivider} />
                  <View style={styles.itemDetailCol}>
                    <Text style={styles.itemDetailLabel}>Next Due</Text>
                    <Text style={styles.itemDetailValue}>
                      {item.nextDueKm.toLocaleString()}
                      <Text style={styles.itemDetailUnit}> km</Text>
                    </Text>
                  </View>
                  <View style={styles.itemDetailDivider} />
                  <View style={styles.itemDetailCol}>
                    <Text style={styles.itemDetailLabel}>
                      {item.kmUntilDue >= 0 ? 'Until Due' : 'Overdue By'}
                    </Text>
                    <Text style={[styles.itemDetailValue, { color: sty.color }]}>
                      {Math.abs(item.kmUntilDue).toLocaleString()}
                      <Text style={[styles.itemDetailUnit, { color: sty.color }]}> km</Text>
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.markServicedBtn}
                  onPress={() => onMarkServiced(item)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#A00000', '#8B0000']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.markServicedGradient}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.markServicedBtnText}>Mark as Serviced</Text>
                  </LinearGradient>
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
            <View style={styles.modalHandle} />
            <View style={styles.modalIconWrap}>
              <Ionicons name="speedometer" size={26} color="#8B0000" />
            </View>
            <Text style={styles.modalTitle}>Update Mileage</Text>
            <Text style={styles.modalSub}>
              Enter the current odometer reading. This will refresh all service due dates.
            </Text>
            <View style={styles.modalInputWrap}>
              <Text style={styles.modalInputPrefix}>km</Text>
              <TextInput
                style={styles.modalInput}
                value={mileageInput}
                onChangeText={setMileageInput}
                placeholder="e.g. 145320"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setMileageModalOpen(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onUpdateMileage}
                activeOpacity={0.85}
                style={styles.modalBtn}
              >
                <LinearGradient
                  colors={['#A00000', '#8B0000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.modalBtnPrimary}
                >
                  <Text style={styles.modalBtnPrimaryText}>Update</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  safeArea: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { color: '#6B7280', marginTop: 12, fontSize: 14, fontWeight: '500' },

  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  clearBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', letterSpacing: -0.3 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // ── Mileage hero card ─────────────────────────────────────────────────
  mileageCard: {
    borderRadius: 22, padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 6,
  },
  mileageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  mileageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  mileageBadgeText: { color: '#FCA5A5', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  mileageEnginePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
  },
  mileageEnginePillText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },

  mileageMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  mileageValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  mileageUnit: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  mileageNote: {
    fontSize: 11, color: 'rgba(255,255,255,0.55)',
    marginTop: 6, fontWeight: '500',
  },

  updateMileageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 16,
    paddingVertical: 11, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  updateMileageBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // ── Summary stats row (3 columns) ─────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  statIconChip: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22, fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11, color: '#6B7280', fontWeight: '600',
    marginTop: 2,
  },

  // ── Section header ────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12, marginTop: 4,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconChip: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', letterSpacing: -0.2 },
  sectionCountPill: {
    minWidth: 28, height: 22, paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: '#1F2937',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // ── Item card ─────────────────────────────────────────────────────────
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18, padding: 16,
    marginBottom: 12,
    borderWidth: 1, borderColor: '#F0F0F2',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  itemAccentBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIconCircle: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '800', color: '#1F2937', letterSpacing: -0.2 },
  itemInterval: { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  itemBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10,
  },
  itemBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  itemBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  itemProgressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 14,
  },
  itemProgressBar: {
    flex: 1,
    height: 7, backgroundColor: '#F3F4F6',
    borderRadius: 4, overflow: 'hidden',
  },
  itemProgressFill: { height: '100%', borderRadius: 4 },
  itemProgressText: {
    fontSize: 11, fontWeight: '800',
    minWidth: 36, textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  itemDetails: {
    flexDirection: 'row',
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  itemDetailCol: { flex: 1, alignItems: 'center' },
  itemDetailDivider: { width: 1, backgroundColor: '#F0F0F2' },
  itemDetailLabel: {
    fontSize: 10, color: '#9CA3AF', marginBottom: 4,
    fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase',
  },
  itemDetailValue: {
    fontSize: 14, fontWeight: '800', color: '#1F2937',
    fontVariant: ['tabular-nums'],
  },
  itemDetailUnit: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },

  markServicedBtn: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  markServicedGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  markServicedBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },

  // ── Modal ─────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    alignItems: 'center',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1F2937', marginBottom: 6, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: '#6B7280', marginBottom: 18, textAlign: 'center', lineHeight: 18 },
  modalInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingLeft: 14,
    marginBottom: 18,
    backgroundColor: '#F9FAFB',
  },
  modalInputPrefix: {
    fontSize: 14, fontWeight: '700', color: '#8B0000',
    marginRight: 10, letterSpacing: 0.3,
  },
  modalInput: {
    flex: 1, paddingVertical: 14, paddingRight: 14,
    fontSize: 17, color: '#1F2937', fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  modalBtn: {
    flex: 1, borderRadius: 12,
    overflow: 'hidden',
  },
  modalBtnCancel: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnCancelText: { color: '#6B7280', fontSize: 14, fontWeight: '700' },
  modalBtnPrimary: {
    paddingVertical: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
});
