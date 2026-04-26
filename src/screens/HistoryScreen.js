import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar, Alert,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../config/firebase';
import ReportService from '../services/ReportService';

const LABEL_COLOR  = { Normal: '#10B981', Warning: '#F59E0B', Critical: '#EF4444' };
const LABEL_ICON   = { Normal: 'checkmark-circle', Warning: 'warning', Critical: 'alert-circle' };
const DTC_HIST_KEY = '@svd_dtc_history';
const TABS = ['Sessions', 'DTC History'];

function formatDate(val) {
  if (!val) return '—';
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatChip({ label, value, color }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

export default function HistoryScreen({ navigation }) {
  const [activeTab,    setActiveTab]    = useState(0);
  const [sessions,     setSessions]     = useState([]);
  const [dtcHistory,   setDtcHistory]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [exporting,    setExporting]    = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadSessions(), loadDtcHistory()]);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSessions(), loadDtcHistory()]);
    setRefreshing(false);
  }, []);

  // ── Firestore: training sessions ──────────────────────────────────────────
  const loadSessions = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const q = query(
        collection(db, 'trainingData'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.warn('HistoryScreen: loadSessions error', e.message);
    }
  };

  // ── AsyncStorage: DTC scan history ───────────────────────────────────────
  const loadDtcHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(DTC_HIST_KEY);
      setDtcHistory(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setDtcHistory([]);
    }
  };

  // ── Export PDF report ─────────────────────────────────────────────────────
  const handleExport = async () => {
    if (sessions.length === 0) {
      Alert.alert('No Data', 'Record at least one OBD session before exporting.');
      return;
    }
    setExporting(true);
    try {
      await ReportService.exportPDF({
        vehicle: null,
        sensorData: null,
        faultCodes: dtcHistory.flatMap(d => d.codes || []),
        healthScore: null,
        prediction: null,
        sessions,
        timestamp: Date.now(),
      });
    } catch (e) {
      Alert.alert('Export Failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Render: session card ──────────────────────────────────────────────────
  const renderSession = ({ item }) => {
    const lc = LABEL_COLOR[item.label] || '#6B7280';
    return (
      <View style={styles.card}>
        <View style={[styles.cardAccent, { backgroundColor: lc }]} />
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name={LABEL_ICON[item.label] || 'ellipse'} size={20} color={lc} />
            <Text style={[styles.cardLabel, { color: lc }]}>{item.label}</Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
        </View>

        <View style={styles.chipRow}>
          <StatChip label="RPM"     value={item.avg_rpm?.toFixed(0)        || '—'} />
          <StatChip label="Coolant" value={`${item.avg_coolantTemp?.toFixed(1) || '—'}°C`} />
          <StatChip label="Load"    value={`${item.avg_engineLoad?.toFixed(1)  || '—'}%`} />
          <StatChip label="Voltage" value={`${item.avg_voltage?.toFixed(1)     || '—'}V`} />
        </View>

        <View style={styles.cardFooter}>
          <Ionicons name="camera-outline" size={13} color="#9CA3AF" />
          <Text style={styles.cardFooterText}>{item.snapshotCount || 0} snapshots</Text>
          {item.vehicleBrand && item.vehicleBrand !== 'Unknown' && (
            <>
              <Text style={styles.dot}>·</Text>
              <Ionicons name="car-sport-outline" size={13} color="#9CA3AF" />
              <Text style={styles.cardFooterText}>{item.vehicleBrand}</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  // ── Render: DTC history card ──────────────────────────────────────────────
  const renderDtc = ({ item }) => (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: '#EF4444' }]} />
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="search-outline" size={18} color="#EF4444" />
          <Text style={[styles.cardLabel, { color: '#EF4444' }]}>DTC Scan</Text>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.timestamp)}</Text>
      </View>
      {(item.codes || []).length === 0 ? (
        <Text style={styles.noDtcText}>✅ No fault codes detected</Text>
      ) : (
        <View style={styles.dtcList}>
          {(item.codes || []).map(code => (
            <View key={code.code || code} style={styles.dtcBadge}>
              <Text style={styles.dtcCode}>{code.code || code}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  const Empty = ({ tab }) => (
    <View style={styles.emptyBox}>
      <Ionicons name={tab === 0 ? 'layers-outline' : 'search-outline'} size={56} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{tab === 0 ? 'No Sessions Yet' : 'No DTC Scans Yet'}</Text>
      <Text style={styles.emptyText}>
        {tab === 0
          ? 'Record OBD sessions in Data Collection to see them here.'
          : 'Scan for fault codes in the Fault Codes screen to build history.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>History</Text>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            style={styles.exportBtn}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#8B0000" />
              : <Ionicons name="share-outline" size={22} color="#8B0000" />}
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
              {activeTab === i && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary banner */}
        {!loading && (
          <LinearGradient colors={['#8B0000', '#A00000']} style={styles.banner}>
            <View style={styles.bannerItem}>
              <Text style={styles.bannerNum}>{sessions.length}</Text>
              <Text style={styles.bannerLabel}>Sessions</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={styles.bannerNum}>
                {sessions.filter(s => s.label === 'Normal').length}
              </Text>
              <Text style={styles.bannerLabel}>Normal</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={styles.bannerNum}>
                {sessions.filter(s => s.label === 'Warning').length}
              </Text>
              <Text style={styles.bannerLabel}>Warning</Text>
            </View>
            <View style={styles.bannerDivider} />
            <View style={styles.bannerItem}>
              <Text style={styles.bannerNum}>
                {sessions.filter(s => s.label === 'Critical').length}
              </Text>
              <Text style={styles.bannerLabel}>Critical</Text>
            </View>
          </LinearGradient>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#8B0000" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === 0 ? sessions : dtcHistory}
            keyExtractor={(item, i) => item.id || String(i)}
            renderItem={activeTab === 0 ? renderSession : renderDtc}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B0000']} />}
            ListEmptyComponent={<Empty tab={activeTab} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safe:      { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  exportBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },

  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', position: 'relative' },
  tabActive: {},
  tabText:       { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  tabTextActive: { color: '#8B0000', fontWeight: '700' },
  tabUnderline:  { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: '#8B0000', borderRadius: 1 },

  banner: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'space-around' },
  bannerItem:    { alignItems: 'center', flex: 1 },
  bannerNum:     { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  bannerLabel:   { fontSize: 10, color: '#FCA5A5', marginTop: 2 },
  bannerDivider: { width: 1, height: 32, backgroundColor: '#FFFFFF30' },

  list: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardAccent:     { height: 3 },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabel:      { fontSize: 15, fontWeight: '700' },
  cardDate:       { fontSize: 11, color: '#9CA3AF' },

  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10, flexWrap: 'wrap' },
  chip:      { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  chipLabel: { fontSize: 9, color: '#9CA3AF', marginBottom: 2 },
  chipValue: { fontSize: 13, fontWeight: '700', color: '#1F2937' },

  cardFooter:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 12 },
  cardFooterText: { fontSize: 12, color: '#9CA3AF' },
  dot:            { fontSize: 12, color: '#D1D5DB' },

  noDtcText: { fontSize: 13, color: '#10B981', paddingHorizontal: 14, paddingBottom: 12 },
  dtcList:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 12 },
  dtcBadge:  { backgroundColor: '#1F2937', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  dtcCode:   { fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },

  loadingBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },

  emptyBox:  { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle:{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
});
