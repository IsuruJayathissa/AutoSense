import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import OBDService from '../services/OBDService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH     = SCREEN_WIDTH - 32;
const MAX_DATA_POINTS = 20;
const POLL_INTERVAL   = 2000; // ms

// ── Tabs ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'rpm',         label: 'RPM',  icon: 'speedometer' },
  { key: 'temperature', label: 'Temp', icon: 'thermometer' },
  { key: 'load',        label: 'Load', icon: 'construct'   },
];

const TAB_COLORS = {
  rpm:         '#8B0000',
  temperature: '#F59E0B',
  load:        '#3B82F6',
};

const CHART_CONFIG_BASE = {
  backgroundGradientFrom:    '#FFFFFF',
  backgroundGradientTo:      '#FFFFFF',
  decimalCount:              0,
  propsForDots:              { r: '4', strokeWidth: '2' },
  propsForBackgroundLines:   { strokeDasharray: '', stroke: '#E5E7EB', strokeWidth: 1 },
  propsForLabels:            { fontSize: 11, fontWeight: '500' },
  fillShadowGradientOpacity: 0.15,
  useShadowColorFromDataset: false,
};

const CHART_CONFIGS = {
  rpm: {
    ...CHART_CONFIG_BASE,
    color:              (o = 1) => `rgba(139,0,0,${o})`,
    labelColor:         (o = 1) => `rgba(107,114,128,${o})`,
    fillShadowGradient: '#8B0000',
    propsForDots: { ...CHART_CONFIG_BASE.propsForDots, stroke: '#8B0000', fill: '#FFFFFF' },
  },
  temperature: {
    ...CHART_CONFIG_BASE,
    color:              (o = 1) => `rgba(245,158,11,${o})`,
    labelColor:         (o = 1) => `rgba(107,114,128,${o})`,
    fillShadowGradient: '#F59E0B',
    propsForDots: { ...CHART_CONFIG_BASE.propsForDots, stroke: '#F59E0B', fill: '#FFFFFF' },
  },
  load: {
    ...CHART_CONFIG_BASE,
    color:              (o = 1) => `rgba(59,130,246,${o})`,
    labelColor:         (o = 1) => `rgba(107,114,128,${o})`,
    fillShadowGradient: '#3B82F6',
    propsForDots: { ...CHART_CONFIG_BASE.propsForDots, stroke: '#3B82F6', fill: '#FFFFFF' },
  },
};

// ── Chart metadata & thresholds ────────────────────────────────────────────
const CHART_META = {
  rpm: {
    title:       'Engine RPM Over Time',
    unit:        'RPM',
    description: 'Real-time engine revolutions per minute from OBD-II sensor 010C.',
    thresholds:  { warning: 4500, critical: 5500 },
    alerts: {
      critical: 'RPM critically high — risk of engine damage.',
      warning:  'High RPM sustained — possible engine strain.',
      normal:   'RPM within normal operating range.',
    },
  },
  temperature: {
    title:       'Coolant Temperature Trend',
    unit:        '°C',
    description: 'Real-time coolant temperature from OBD-II sensor 0105.',
    thresholds:  { warning: 95, critical: 105 },
    alerts: {
      critical: 'Engine may overheat — check cooling system immediately.',
      warning:  'Approaching high temperature threshold (105°C).',
      normal:   'Temperature within safe operating range.',
    },
  },
  load: {
    title:       'Engine Load Over Time',
    unit:        '%',
    description: 'Real-time engine load from OBD-II sensor 0104. High sustained load combined with rising temperature indicates overheating risk.',
    thresholds:  { warning: 70, critical: 85 },
    alerts: {
      critical: 'Critical engine load — risk of overheating and excessive wear.',
      warning:  'High engine load — monitor coolant temperature closely.',
      normal:   'Engine load within normal range.',
    },
  },
};

// ── Validation helpers ─────────────────────────────────────────────────────
const isValidNumber = (val) =>
  val !== null && val !== undefined && !isNaN(val) && isFinite(val) && val >= 0;

const sanitize = (val, fallback = null) =>
  isValidNumber(val) ? parseFloat(val) : fallback;

export default function DataChartsScreen({ navigation }) {
  const [obdConnected, setObdConnected] = useState(OBDService.isConnected);

  const [activeTab,    setActiveTab]    = useState('rpm');
  const [rpmHistory,   setRpmHistory]   = useState([]);
  const [tempHistory,  setTempHistory]  = useState([]);
  const [loadHistory,  setLoadHistory]  = useState([]);
  const [timeLabels,   setTimeLabels]   = useState([]);

  // Connection & error state
  const [connectionError, setConnectionError] = useState(false);
  const [pollError,       setPollError]       = useState(null);
  const [lastUpdated,     setLastUpdated]      = useState(null);
  const [consecutiveFails, setConsecutiveFails] = useState(0);

  const intervalRef = useRef(null);
  const tickRef     = useRef(0);

  // ── Add validated data point ─────────────────────────────────────────────
  const addDataPoint = useCallback((data) => {
    // Validate all required fields before accepting
    const rpm       = sanitize(data?.rpm);
    const coolant   = sanitize(data?.coolantTemp);
    const load      = sanitize(data?.engineLoad);

    // Reject the entire snapshot if critical fields are missing
    if (rpm === null || coolant === null || load === null) {
      console.warn('[DataCharts] Incomplete snapshot rejected:', data);
      return false;
    }

    // Reject clearly out-of-range values
    if (rpm > 10000 || coolant > 150 || coolant < -40 || load > 100) {
      console.warn('[DataCharts] Out-of-range snapshot rejected:', { rpm, coolant, load });
      return false;
    }

    tickRef.current += 1;
    const tick  = tickRef.current;
    const label = tick % 5 === 0 ? `${tick * 2}s` : '';

    setRpmHistory(prev => {
      const next = [...prev, rpm];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
    setTempHistory(prev => {
      const next = [...prev, coolant];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
    setLoadHistory(prev => {
      const next = [...prev, load];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
    setTimeLabels(prev => {
      const next = [...prev, label];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });

    setLastUpdated(new Date());
    setConsecutiveFails(0);
    setPollError(null);
    return true;
  }, []);

  // ── Connection listener ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = OBDService.onConnectionChange((connected) => {
      setObdConnected(connected);
      if (!connected) {
        setConnectionError(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });
    return unsubscribe;
  }, []);

  // ── Polling effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!obdConnected) {
      setConnectionError(true);
      return;
    }

    setConnectionError(false);
    setPollError(null);

    intervalRef.current = setInterval(async () => {
      try {
        const data = await OBDService.getSensorData();

        if (!data) {
          setConsecutiveFails(prev => {
            const next = prev + 1;
            if (next >= 3) {
              setPollError('Lost connection to OBD device. Please reconnect.');
              clearInterval(intervalRef.current);
            } else {
              setPollError(`Retrying... (${next}/3)`);
            }
            return next;
          });
          return;
        }

        const accepted = addDataPoint(data);
        if (!accepted) {
          setPollError('Invalid sensor reading received — skipped.');
          setTimeout(() => setPollError(null), 2000);
        }

      } catch (error) {
        console.error('[DataCharts] Poll error:', error.message);
        setPollError('Sensor read error: ' + error.message);
        setConsecutiveFails(prev => prev + 1);
      }
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [obdConnected, addDataPoint]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const getStats = (data) => {
    if (!data.length) return { min: 0, max: 0, avg: 0 };
    return {
      min: Math.min(...data),
      max: Math.max(...data),
      avg: Math.round(data.reduce((a, b) => a + b, 0) / data.length),
    };
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'rpm':         return rpmHistory;
      case 'temperature': return tempHistory;
      case 'load':        return loadHistory;
      default:            return [];
    }
  };

  // ── Threshold alert ────────────────────────────────────────────────────────
  const getAlert = (tabKey, maxVal) => {
    if (!maxVal) return null;
    const { thresholds, alerts } = CHART_META[tabKey];
    if (maxVal > thresholds.critical) return { level: 'Critical', color: '#EF4444', bg: '#FEF2F2', icon: 'alert-circle',     msg: alerts.critical };
    if (maxVal > thresholds.warning)  return { level: 'Warning',  color: '#F59E0B', bg: '#FFFBEB', icon: 'warning',          msg: alerts.warning  };
    return                                   { level: 'Normal',   color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle', msg: alerts.normal   };
  };

  const activeData    = getActiveData();
  const stats         = getStats(activeData);
  const meta          = CHART_META[activeTab];
  const accentColor   = TAB_COLORS[activeTab];
  const chartData     = activeData.length >= 2 ? activeData : null;
  const labels        = timeLabels.length >= 2 ? timeLabels : [];
  const displayLabels = labels.map((l, i) => (i % 4 === 0 ? l : ''));
  const alert         = getAlert(activeTab, stats.max);
  const hasData       = activeData.length >= 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Data Charts</Text>
          <View style={[styles.statusBadge, {
            backgroundColor: obdConnected && !connectionError
              ? '#10B981' : '#EF4444'
          }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>
              {obdConnected && !connectionError ? 'LIVE' : 'OFF'}
            </Text>
          </View>
        </View>

        {/* ── Not Connected Banner ───────────────────────────────────────── */}
        {connectionError && (
          <View style={styles.notConnectedBanner}>
            <Ionicons name="bluetooth-outline" size={20} color="#EF4444" />
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerTitle}>OBD-II Device Not Connected</Text>
              <Text style={styles.bannerSub}>
                Connect your ELM327 adapter to view real-time charts.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bannerBtn}
              onPress={() => navigation.navigate('OBDConnection')}
            >
              <Text style={styles.bannerBtnText}>Connect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Poll Error Banner ──────────────────────────────────────────── */}
        {pollError && !connectionError && (
          <View style={styles.pollErrorBanner}>
            <Ionicons name="warning-outline" size={18} color="#F59E0B" />
            <Text style={styles.pollErrorText}>{pollError}</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && {
                  backgroundColor: TAB_COLORS[tab.key],
                  borderColor:     TAB_COLORS[tab.key],
                }]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon} size={18} color={isActive ? '#FFFFFF' : '#6B7280'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* Chart Title */}
          <View style={styles.chartTitleCard}>
            <View style={[styles.chartTitleBorder, { backgroundColor: accentColor }]} />
            <View style={styles.chartTitleRow}>
              <Ionicons name="analytics" size={22} color={accentColor} />
              <Text style={styles.chartTitle}>{meta.title}</Text>
            </View>
            <Text style={styles.chartDescription}>{meta.description}</Text>
            {lastUpdated && (
              <Text style={styles.lastUpdated}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Text>
            )}
          </View>

          {/* Chart */}
          <View style={styles.chartCard}>
            <View style={[styles.chartCardBorder, { backgroundColor: accentColor }]} />

            {connectionError ? (
              // Not connected state
              <View style={styles.chartPlaceholder}>
                <Ionicons name="bluetooth-outline" size={48} color="#D1D5DB" />
                <Text style={styles.chartPlaceholderText}>No OBD Connection</Text>
                <Text style={styles.chartPlaceholderSubtext}>
                  Connect your ELM327 device to see live charts
                </Text>
              </View>
            ) : !hasData ? (
              // Connected but waiting for data
              <View style={styles.chartPlaceholder}>
                <Ionicons name="bar-chart-outline" size={48} color="#D1D5DB" />
                <Text style={styles.chartPlaceholderText}>Collecting Data...</Text>
                <Text style={styles.chartPlaceholderSubtext}>
                  Reading sensor values — chart appears in a few seconds
                </Text>
              </View>
            ) : (
              // Real data chart
              <LineChart
                data={{
                  labels: displayLabels,
                  datasets: [{ data: chartData, strokeWidth: 3 }],
                }}
                width={CHART_WIDTH - 24}
                height={220}
                chartConfig={CHART_CONFIGS[activeTab]}
                bezier
                style={styles.chart}
                withInnerLines
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines
                withVerticalLabels
                withHorizontalLabels
                fromZero={activeTab === 'load'}
                segments={4}
              />
            )}
          </View>

          {/* Threshold Alert */}
          {alert && hasData && (
            <View style={[styles.thresholdCard, {
              borderColor:     alert.color,
              backgroundColor: alert.bg,
            }]}>
              <Ionicons name={alert.icon} size={22} color={alert.color} />
              <View style={styles.thresholdTextContainer}>
                <Text style={[styles.thresholdTitle, { color: alert.color }]}>
                  {alert.level} — {meta.title.split(' ')[0]} {meta.title.split(' ')[1]}
                </Text>
                <Text style={[styles.thresholdSubtitle, { color: alert.color }]}>
                  {alert.msg}
                </Text>
              </View>
            </View>
          )}

          {/* Session Stats */}
          {hasData && (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="stats-chart" size={20} color="#1F2937" />
                <Text style={styles.sectionTitle}>Session Statistics</Text>
              </View>

              <View style={styles.statsRow}>
                {[
                  { label: 'Minimum', value: stats.min, color: '#10B981', icon: 'arrow-down',  bgColor: '#10B98120' },
                  { label: 'Average', value: stats.avg, color: accentColor, icon: 'remove',    bgColor: accentColor + '20' },
                  { label: 'Maximum', value: stats.max, color: '#EF4444',  icon: 'arrow-up',   bgColor: '#EF444420' },
                ].map(s => (
                  <View key={s.label} style={styles.statCard}>
                    <View style={[styles.statIconBg, { backgroundColor: s.bgColor }]}>
                      <Ionicons name={s.icon} size={18} color={s.color} />
                    </View>
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statUnit}>{meta.unit}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Info Card */}
          <View style={styles.infoCard}>
            {[
              { icon: 'ellipsis-horizontal-circle', label: 'Data Points',    value: activeData.length + ' / ' + MAX_DATA_POINTS },
              { icon: 'time-outline',               label: 'Sampling Rate',  value: 'Every ' + (POLL_INTERVAL / 1000) + 's' },
              { icon: 'bluetooth',                  label: 'Data Source',    value: obdConnected ? 'Real OBD-II' : 'Not connected' },
              { icon: 'shield-checkmark-outline',   label: 'Validation',     value: 'Active' },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <View style={styles.infoLeft}>
                    <Ionicons name={row.icon} size={20} color="#6B7280" />
                    <Text style={styles.infoLabel}>{row.label}</Text>
                  </View>
                  <Text style={[styles.infoValue, row.label === 'Data Source' && !obdConnected && { color: '#EF4444' }]}>
                    {row.value}
                  </Text>
                </View>
                {i < arr.length - 1 && <View style={styles.infoDivider} />}
              </View>
            ))}
          </View>

          {/* Load + Temp tip */}
          {activeTab === 'load' && hasData && (
            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={20} color="#3B82F6" />
              <Text style={styles.tipText}>
                <Text style={{ fontWeight: '700' }}>Tip: </Text>
                Compare this with the Temperature chart. High load + rising temperature together is an early overheating warning.
              </Text>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea:  { flex: 1 },

  header: {
    backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle:     { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  statusDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // Not connected banner
  notConnectedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#FECACA',
  },
  bannerTextCol: { flex: 1 },
  bannerTitle:   { fontSize: 13, fontWeight: '700', color: '#991B1B' },
  bannerSub:     { fontSize: 12, color: '#EF4444', marginTop: 2 },
  bannerBtn: {
    backgroundColor: '#8B0000', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 8,
  },
  bannerBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // Poll error banner
  pollErrorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  pollErrorText: { fontSize: 13, color: '#92400E', flex: 1 },

  tabContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 12, gap: 6,
    backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  tabLabel:       { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FFFFFF' },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  chartTitleCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden',
  },
  chartTitleBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  chartTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  chartTitle:       { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  chartDescription: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  lastUpdated:      { fontSize: 11, color: '#9CA3AF', marginTop: 6 },

  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  chartCardBorder:         { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  chart:                   { borderRadius: 12, marginTop: 8 },
  chartPlaceholder:        { height: 220, justifyContent: 'center', alignItems: 'center' },
  chartPlaceholderText:    { fontSize: 16, fontWeight: '600', color: '#9CA3AF', marginTop: 12 },
  chartPlaceholderSubtext: { fontSize: 12, color: '#D1D5DB', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },

  thresholdCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    padding: 14, marginBottom: 16, borderWidth: 1.5, gap: 12,
  },
  thresholdTextContainer: { flex: 1 },
  thresholdTitle:         { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  thresholdSubtitle:      { fontSize: 12, lineHeight: 16 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  statIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statLabel:  { fontSize: 11, color: '#9CA3AF', marginBottom: 4, fontWeight: '500' },
  statValue:  { fontSize: 22, fontWeight: '800' },
  statUnit:   { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  infoCard:    { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  infoRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  infoLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel:   { fontSize: 14, color: '#4B5563', fontWeight: '500' },
  infoValue:   { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  infoDivider: { height: 1, backgroundColor: '#F3F4F6' },

  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16,
  },
  tipText: { flex: 1, fontSize: 13, color: '#1D4ED8', lineHeight: 20 },
});
