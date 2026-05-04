import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InspectionService from '../services/InspectionService';

const DTC_HIST_KEY = '@svd_dtc_history';
const TABS = ['Inspections', 'DTC History'];

function formatDate(val) {
  if (!val) return '—';
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryScreen({ navigation }) {
  const [activeTab,    setActiveTab]    = useState(0);
  const [inspections,  setInspections]  = useState([]);
  const [dtcHistory,   setDtcHistory]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadInspections(), loadDtcHistory()]);
    setLoading(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadInspections(), loadDtcHistory()]);
    setRefreshing(false);
  }, []);

  // ── Firestore: vehicle inspections ───────────────────────────────────────
  const loadInspections = async () => {
    try {
      const docs = await InspectionService.listInspections();
      setInspections(docs);
    } catch (e) {
      console.warn('HistoryScreen: loadInspections error', e.message);
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

  // ── Render: compact inspection row ───────────────────────────────────────
  const renderInspection = ({ item }) => {
    const s = item.summary || { green: 0, yellow: 0, red: 0, na: 0, total: 0 };
    const accent = s.red > 0 ? '#EF4444' : s.yellow > 0 ? '#F59E0B' : '#10B981';
    const accentLabel = s.red > 0 ? 'Action' : s.yellow > 0 ? 'Monitor' : 'Good';

    return (
      <TouchableOpacity
        style={styles.inspRow}
        onPress={() => navigation.navigate('InspectionDetail', { inspection: item })}
        activeOpacity={0.7}
      >
        {/* Left coloured bar */}
        <View style={[styles.inspBar, { backgroundColor: accent }]} />

        {/* Body */}
        <View style={styles.inspBody}>
          <View style={styles.inspTopLine}>
            <View style={[styles.inspStatusPill, { backgroundColor: `${accent}15`, borderColor: accent }]}>
              <View style={[styles.inspStatusDot, { backgroundColor: accent }]} />
              <Text style={[styles.inspStatusText, { color: accent }]}>{accentLabel}</Text>
            </View>
            <Text style={styles.inspDate}>{formatDate(item.createdAt)}</Text>
          </View>

          <Text style={styles.inspVehicle} numberOfLines={1}>
            {item.brand || '—'} {item.model || ''} {item.vehicleNumber ? `(${item.vehicleNumber})` : ''}
          </Text>

          <View style={styles.inspMetrics}>
            <Metric color="#10B981" value={s.green}  />
            <Metric color="#F59E0B" value={s.yellow} />
            <Metric color="#EF4444" value={s.red}    />
            {item.healthScore != null && (
              <Text style={styles.inspScore}>· {item.healthScore}/100</Text>
            )}
            {(item.faultCodes || []).length > 0 && (
              <Text style={styles.inspDtcCount}>· {item.faultCodes.length} DTC</Text>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  // ── Render: DTC history card ─────────────────────────────────────────────
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

  // ── Empty state ──────────────────────────────────────────────────────────
  const Empty = ({ tab }) => {
    const meta = [
      { icon: 'clipboard-outline', title: 'No Inspections Yet', text: 'Complete a Vehicle Inspection from Home to see it here.' },
      { icon: 'search-outline',    title: 'No DTC Scans Yet',   text: 'Scan for fault codes in the Fault Codes screen to build history.' },
    ][tab];
    return (
      <View style={styles.emptyBox}>
        <Ionicons name={meta.icon} size={56} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>{meta.title}</Text>
        <Text style={styles.emptyText}>{meta.text}</Text>
      </View>
    );
  };

  // Pick data + renderer based on the active tab
  const tabData = activeTab === 0 ? inspections : dtcHistory;
  const tabRenderer = activeTab === 0 ? renderInspection : renderDtc;

  // Aggregate inspection traffic-light counts for the banner
  const inspTotals = inspections.reduce((acc, ins) => {
    const s = ins.summary || {};
    acc.green  += s.green  || 0;
    acc.yellow += s.yellow || 0;
    acc.red    += s.red    || 0;
    return acc;
  }, { green: 0, yellow: 0, red: 0 });

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
          <View style={{ width: 44 }} />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={styles.tab}
              onPress={() => setActiveTab(i)}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
              {activeTab === i && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary banner — content depends on active tab */}
        {!loading && (
          <LinearGradient colors={['#8B0000', '#A00000']} style={styles.banner}>
            {activeTab === 0 && (
              <>
                <View style={styles.bannerItem}>
                  <Text style={styles.bannerNum}>{inspections.length}</Text>
                  <Text style={styles.bannerLabel}>Inspections</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                  <Text style={styles.bannerNum}>{inspTotals.green}</Text>
                  <Text style={styles.bannerLabel}>Good</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                  <Text style={styles.bannerNum}>{inspTotals.yellow}</Text>
                  <Text style={styles.bannerLabel}>Monitor</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                  <Text style={styles.bannerNum}>{inspTotals.red}</Text>
                  <Text style={styles.bannerLabel}>Action</Text>
                </View>
              </>
            )}
            {activeTab === 1 && (
              <>
                <View style={styles.bannerItem}>
                  <Text style={styles.bannerNum}>{dtcHistory.length}</Text>
                  <Text style={styles.bannerLabel}>Scans</Text>
                </View>
                <View style={styles.bannerDivider} />
                <View style={styles.bannerItem}>
                  <Text style={styles.bannerNum}>
                    {dtcHistory.reduce((n, d) => n + (d.codes?.length || 0), 0)}
                  </Text>
                  <Text style={styles.bannerLabel}>Codes Found</Text>
                </View>
              </>
            )}
          </LinearGradient>
        )}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#8B0000" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : (
          <FlatList
            data={tabData}
            keyExtractor={(item, i) => item.id || String(i)}
            renderItem={tabRenderer}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B0000']} />}
            ListEmptyComponent={<Empty tab={activeTab} />}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function Metric({ color, value }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricDot, { backgroundColor: color }]} />
      <Text style={styles.metricValue}>{value}</Text>
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
  backBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },

  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab:    { flex: 1, paddingVertical: 12, alignItems: 'center', position: 'relative' },
  tabText:       { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  tabTextActive: { color: '#8B0000', fontWeight: '700' },
  tabUnderline:  { position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 2, backgroundColor: '#8B0000', borderRadius: 1 },

  banner: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'space-around' },
  bannerItem:    { alignItems: 'center', flex: 1 },
  bannerNum:     { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  bannerLabel:   { fontSize: 10, color: '#FCA5A5', marginTop: 2 },
  bannerDivider: { width: 1, height: 32, backgroundColor: '#FFFFFF30' },

  list: { padding: 16, paddingBottom: 40 },

  // Compact inspection row
  inspRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB',
    paddingRight: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  inspBar: { width: 5, alignSelf: 'stretch' },
  inspBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  inspTopLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  inspStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1,
  },
  inspStatusDot: { width: 5, height: 5, borderRadius: 3 },
  inspStatusText: { fontSize: 11, fontWeight: '700' },
  inspDate: { fontSize: 11, color: '#9CA3AF' },
  inspVehicle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  inspMetrics: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  metricValue: { fontSize: 12, fontWeight: '700', color: '#374151' },
  inspScore: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  inspDtcCount: { fontSize: 11, color: '#EF4444', fontWeight: '700' },

  // DTC card (kept for DTC tab)
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
