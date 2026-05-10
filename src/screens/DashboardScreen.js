import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import OBDService from '../services/OBDService';

const { width: WIN_WIDTH } = Dimensions.get('window');
// Hero RPM gauge — large and centered. Cap so it doesn't get oversized on tablets.
const HERO_GAUGE_SIZE = Math.min(WIN_WIDTH - 80, 300);
// Mini circular gauges (used inside the secondary 2x2 grid)
const MINI_GAUGE_SIZE = 88;

// Classify the engine's running state from a recent batch of polls.
//   unsupported: vehicle reported soft-success (no Mode 01 PIDs at all)
//   off:         consistent zero RPM and no alternator voltage (<13V)
//   running:     RPM > 300 or alternator voltage detected
//   unknown:     not enough samples yet
const detectEngineState = (history) => {
  if (OBDService.lastConnectError &&
      /live data|Mode 01|service not supported|proprietary/i.test(OBDService.lastConnectError)) {
    return 'unsupported';
  }
  if (!history || history.length < 2) return 'unknown';
  const recent = history.slice(-3);
  const anyRpm    = recent.some(s => (s.rpm || 0) > 300);
  const altVolts  = recent.some(s => (s.voltage || 0) > 13);
  if (anyRpm || altVolts) return 'running';
  // All recent samples have rpm=0 and voltage<13 → engine is off
  return 'off';
};

export default function DashboardScreen({ navigation }) {
  const [obdConnected, setObdConnected] = useState(OBDService.isConnected);
  const [engineState, setEngineState] = useState('unknown');
  const [demoMode, setDemoModeUI] = useState(OBDService.demoMode);

  const [sensorData, setSensorData] = useState({
    rpm: 0,
    speed: 0,
    coolantTemp: 0,
    throttle: 0,
    fuelLevel: 0,
    engineLoad: 0,
    voltage: 0,
  });

  const intervalRef = useRef(null);
  const historyRef = useRef([]); // last few polls, used for engine-state detection

  useEffect(() => {
    const unsubscribe = OBDService.onConnectionChange((connected) => {
      setObdConnected(connected);
      if (connected) {
        startRealDataPolling();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
        historyRef.current = [];
        setEngineState('unknown');
      }
    });

    if (OBDService.isConnected || OBDService.demoMode) startRealDataPolling();

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startRealDataPolling = () => {
    intervalRef.current = setInterval(async () => {
      const data = await OBDService.getSensorData();
      if (data) {
        setSensorData(data);
        historyRef.current = [...historyRef.current, data].slice(-5);
        setEngineState(detectEngineState(historyRef.current));
      }
    }, 2000);
  };

  const toggleDemoMode = () => {
    const next = !OBDService.demoMode;
    OBDService.setDemoMode(next);
    setDemoModeUI(next);
    if (next) {
      // Clear stale soft-success state so the engine-off banner doesn't show in demo
      OBDService.lastConnectError = null;
      historyRef.current = [];
      setEngineState('running');
      if (!intervalRef.current) startRealDataPolling();
    }
  };


  const getStatusColor = (value, min, max) => {
    if (value > max) return '#EF4444';
    if (value > max * 0.8) return '#F59E0B';
    return '#10B981';
  };

  // Classify RPM into a human-readable engine state label
  const rpmStateLabel = (rpm) => {
    if (!rpm || rpm < 100) return 'Engine Off';
    if (rpm < 1000)        return 'Idle';
    if (rpm < 2500)        return 'Cruising';
    if (rpm < 4000)        return 'Active';
    if (rpm < 5500)        return 'High Load';
    return 'Redline';
  };

  // Hero circular gauge — premium dark dial for RPM
  const HeroGauge = ({ value, unit, max }) => {
    const size = HERO_GAUGE_SIZE;
    const stroke = 16;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const percentage = Math.min(Math.max(safeValue / max, 0), 1);
    const dashOffset = circumference * (1 - percentage * 0.78);
    const cx = size / 2;
    const cy = size / 2;
    const stateLabel = rpmStateLabel(safeValue);
    const stateColor =
      safeValue >= max * 0.85 ? '#EF4444' :
      safeValue >= max * 0.65 ? '#F59E0B' :
      safeValue > 100         ? '#10B981' : '#6B7280';

    return (
      <LinearGradient
        colors={['#1F2937', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroBadge}>
          <View style={[styles.heroBadgeDot, { backgroundColor: stateColor }]} />
          <Text style={[styles.heroBadgeText, { color: stateColor }]}>{stateLabel}</Text>
        </View>

        <View style={[styles.heroGaugeWrap, { width: size, height: size }]}>
          <Svg width={size} height={size} style={styles.heroGaugeSvg}>
            <Defs>
              <SvgGradient id="grad-hero" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FCA5A5" stopOpacity="1" />
                <Stop offset="0.5" stopColor="#EF4444" stopOpacity="1" />
                <Stop offset="1" stopColor="#8B0000" stopOpacity="1" />
              </SvgGradient>
            </Defs>
            {/* Track */}
            <Circle
              cx={cx} cy={cy} r={radius}
              stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circumference * 0.78} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              transform={`rotate(135 ${cx} ${cy})`}
            />
            {/* Value arc */}
            <Circle
              cx={cx} cy={cy} r={radius}
              stroke="url(#grad-hero)" strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circumference * 0.78} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(135 ${cx} ${cy})`}
            />
          </Svg>
          <View style={styles.heroGaugeCenter}>
            <Text style={styles.heroValue}>
              {typeof safeValue === 'number' ? Math.round(safeValue).toLocaleString() : safeValue}
            </Text>
            <Text style={styles.heroUnit}>{unit}</Text>
          </View>
        </View>

        <View style={styles.heroScaleRow}>
          <Text style={styles.heroScaleText}>0</Text>
          <Text style={styles.heroScaleText}>x 1,000</Text>
          <Text style={styles.heroScaleText}>{max.toLocaleString()}</Text>
        </View>
      </LinearGradient>
    );
  };

  // Mini circular gauge (used inside each secondary card)
  const MiniGauge = ({ value, max, color }) => {
    const size = MINI_GAUGE_SIZE;
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    const percentage = Math.min(Math.max(safeValue / max, 0), 1);
    const dashOffset = circumference * (1 - percentage * 0.78);
    const cx = size / 2;
    const cy = size / 2;

    return (
      <Svg width={size} height={size}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="#F3F4F6" strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference * 0.78} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={color} strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference * 0.78} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
      </Svg>
    );
  };

  const GaugeCard = ({ icon, value, unit, label, min, max }) => {
    const statusColor = getStatusColor(value, min, max);
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;

    return (
      <View style={styles.gaugeCard}>
        <View style={styles.gaugeCardHeader}>
          <View style={[styles.gaugeIconChip, { backgroundColor: statusColor + '15' }]}>
            <Ionicons name={icon} size={14} color={statusColor} />
          </View>
          <Text style={styles.gaugeLabel}>{label}</Text>
        </View>

        <View style={styles.gaugeRingWrap}>
          <MiniGauge value={safeValue} max={max} color={statusColor} />
          <View style={styles.gaugeRingCenter}>
            <Text style={[styles.gaugeValue, { color: statusColor }]}>
              {typeof safeValue === 'number'
                ? (safeValue % 1 === 0 ? safeValue : safeValue.toFixed(1))
                : safeValue}
            </Text>
            <Text style={styles.gaugeUnit}>{unit}</Text>
          </View>
        </View>
      </View>
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
          
          <Text style={styles.headerTitle}>Live Dashboard</Text>

          <TouchableOpacity
            onPress={toggleDemoMode}
            activeOpacity={0.7}
            style={[styles.statusBadge, {
              backgroundColor: (demoMode || obdConnected) ? '#10B981' : '#F59E0B',
            }]}
          >
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>
              {(demoMode || obdConnected) ? 'LIVE' : 'SIM'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Connection Warning */}
          {(!obdConnected && !demoMode) && (
            <TouchableOpacity
              style={styles.warningCard}
              onPress={() => navigation.navigate('OBDConnection')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.warningGradient}
              >
                <Ionicons name="warning" size={24} color="#FFFFFF" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>OBD-II Not Connected</Text>
                  <Text style={styles.warningSubtitle}>Tap to connect your OBD-II device</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Engine state warnings — only when connected and not in demo */}
          {!demoMode && obdConnected && engineState === 'off' && (
            <View style={styles.warningCard}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.warningGradient}
              >
                <Ionicons name="key" size={24} color="#FFFFFF" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Start the engine</Text>
                  <Text style={styles.warningSubtitle}>
                    Live sensor data is only available when the engine is running.
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {!demoMode && obdConnected && engineState === 'unsupported' && (
            <TouchableOpacity
              style={styles.warningCard}
              onPress={toggleDemoMode}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.warningGradient}
              >
                <Ionicons name="play-circle" size={24} color="#FFFFFF" />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Tap to Start Live Data</Text>
                  <Text style={styles.warningSubtitle}>
                    Begin streaming sensor readings from your vehicle.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Real-time Indicator */}
          <View style={styles.sectionHeader}>
            <Ionicons name="pulse" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Real-time Sensors</Text>
            {(obdConnected) && (
              <View style={styles.liveIndicator} />
            )}
          </View>

          {/* Headline gauge — RPM hero */}
          <HeroGauge value={sensorData.rpm} unit="RPM" max={8000} />

          {/* Secondary gauges */}
          <View style={styles.gaugeGrid}>
            <GaugeCard
              icon="thermometer"
              value={sensorData.coolantTemp}
              unit="°C"
              label="Coolant Temp"
              min={70}
              max={110}
            />
            <GaugeCard
              icon="speedometer-outline"
              value={sensorData.throttle}
              unit="%"
              label="Throttle"
              min={0}
              max={100}
            />
            <GaugeCard
              icon="construct"
              value={sensorData.engineLoad}
              unit="%"
              label="Engine Load"
              min={0}
              max={100}
            />
            <GaugeCard
              icon="battery-half"
              value={sensorData.voltage}
              unit="V"
              label="Battery"
              min={11}
              max={14.5}
            />
          </View>

          {/* Engine Status Card */}
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Engine Status</Text>
          </View>

          {(() => {
            const cond = (sensorData.coolantTemp > 105 || sensorData.rpm > 5000)
              ? { label: 'Critical', color: '#EF4444', bg: '#FEE2E2', icon: 'alert-circle' }
              : sensorData.coolantTemp > 95
              ? { label: 'Warning', color: '#F59E0B', bg: '#FEF3C7', icon: 'warning' }
              : { label: 'Normal', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' };
            const battOk = sensorData.voltage >= 12;
            return (
              <View style={styles.statusCard}>
                <View style={[styles.statusHero, { backgroundColor: cond.bg }]}>
                  <View style={[styles.statusHeroIcon, { backgroundColor: cond.color }]}>
                    <Ionicons name={cond.icon} size={26} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusHeroLabel}>Overall Condition</Text>
                    <Text style={[styles.statusHeroValue, { color: cond.color }]}>
                      {cond.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.statusInfoRow}>
                  <View style={styles.statusInfoIcon}>
                    <Ionicons name="battery-half" size={18} color="#1F2937" />
                  </View>
                  <Text style={styles.statusInfoLabel}>Battery</Text>
                  <Text style={[styles.statusInfoValue, { color: battOk ? '#10B981' : '#F59E0B' }]}>
                    {sensorData.voltage}V
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Quick Actions */}
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsGrid}>
            {[
              { icon: 'search',     title: 'Scan Faults',  subtitle: 'DTC codes',     screen: 'FaultCodes',   color: '#EF4444', bg: '#FEE2E2' },
              { icon: 'heart',      title: 'Engine Health',subtitle: 'AI diagnosis',  screen: 'EngineHealth', color: '#8B0000', bg: '#FEE2E2' },
              { icon: 'analytics',  title: 'View Charts',  subtitle: 'Live trends',   screen: 'DataCharts',   color: '#3B82F6', bg: '#DBEAFE' },
              { icon: 'time',       title: 'History',      subtitle: 'Past sessions', screen: 'History',      color: '#8B5CF6', bg: '#EDE9FE' },
            ].map((a) => (
              <TouchableOpacity
                key={a.screen}
                style={styles.actionCard}
                onPress={() => navigation.navigate(a.screen)}
                activeOpacity={0.85}
              >
                <View style={[styles.actionIconBox, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icon} size={24} color={a.color} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                  <Text style={styles.actionSubtitle}>{a.subtitle}</Text>
                </View>
                <View style={[styles.actionChevron, { backgroundColor: a.bg }]}>
                  <Ionicons name="arrow-forward" size={14} color={a.color} />
                </View>
              </TouchableOpacity>
            ))}
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Warning Card
  warningCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
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
    flex: 1,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // ── Hero RPM gauge (dark premium dial) ───────────────────────────────
  heroCard: {
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    marginBottom: 16,
  },
  heroBadgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  heroBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  heroGaugeWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroGaugeSvg: { position: 'absolute', top: 0, left: 0 },
  heroGaugeCenter: { alignItems: 'center', justifyContent: 'center' },
  heroValue: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FCA5A5',
    letterSpacing: 2,
    marginTop: -4,
  },

  heroScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '85%',
    marginTop: 12,
  },
  heroScaleText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },

  // ── Secondary 2x2 grid with mini ring gauges ─────────────────────────
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gaugeCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  gaugeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  gaugeIconChip: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  gaugeRingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 4,
  },
  gaugeRingCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  gaugeValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  gaugeUnit: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 1,
  },
  gaugeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    flex: 1,
  },

  // ── Status Card (hero condition + battery info row) ──────────────────
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  statusHeroIcon: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  statusHeroLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 2 },
  statusHeroValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
  },
  statusInfoIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  statusInfoLabel: { flex: 1, fontSize: 13, color: '#374151', fontWeight: '600' },
  statusInfoValue: { fontSize: 16, fontWeight: '800' },

  // Actions Grid — 2x2 white cards with colored accents
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  actionTextWrap: { marginBottom: 12 },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '500',
  },
  actionChevron: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end',
  },
});