import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { LineChart } from 'react-native-chart-kit';
import OBDService from '../services/OBDService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;
const MAX_DATA_POINTS = 20;

const TABS = [
  { key: 'rpm', label: 'RPM', icon: 'speedometer' },
  { key: 'temperature', label: 'Temp', icon: 'thermometer' },
  { key: 'fuel', label: 'Fuel', icon: 'water' },
];

const CHART_CONFIG_BASE = {
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalCount: 0,
  propsForDots: {
    r: '4',
    strokeWidth: '2',
  },
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: '#E5E7EB',
    strokeWidth: 1,
  },
  propsForLabels: {
    fontSize: 11,
    fontWeight: '500',
  },
  fillShadowGradientOpacity: 0.15,
  useShadowColorFromDataset: false,
};

const CHART_CONFIGS = {
  rpm: {
    ...CHART_CONFIG_BASE,
    color: (opacity = 1) => `rgba(139, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    fillShadowGradient: '#8B0000',
    propsForDots: {
      ...CHART_CONFIG_BASE.propsForDots,
      stroke: '#8B0000',
      fill: '#FFFFFF',
    },
  },
  temperature: {
    ...CHART_CONFIG_BASE,
    color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    fillShadowGradient: '#F59E0B',
    propsForDots: {
      ...CHART_CONFIG_BASE.propsForDots,
      stroke: '#F59E0B',
      fill: '#FFFFFF',
    },
  },
  fuel: {
    ...CHART_CONFIG_BASE,
    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    fillShadowGradient: '#10B981',
    propsForDots: {
      ...CHART_CONFIG_BASE.propsForDots,
      stroke: '#10B981',
      fill: '#FFFFFF',
    },
  },
};

const TAB_COLORS = {
  rpm: '#8B0000',
  temperature: '#F59E0B',
  fuel: '#10B981',
};

export default function DataChartsScreen({ navigation, route }) {
  const isConnected = route?.params?.isConnected || false;
  const [activeTab, setActiveTab] = useState('rpm');
  const [rpmHistory, setRpmHistory] = useState([]);
  const [tempHistory, setTempHistory] = useState([]);
  const [fuelHistory, setFuelHistory] = useState([]);
  const [timeLabels, setTimeLabels] = useState([]);
  const intervalRef = useRef(null);
  const tickRef = useRef(0);

  const addDataPoint = useCallback((data) => {
    tickRef.current += 1;
    const tick = tickRef.current;
    const label = tick % 5 === 0 ? `${tick * 2}s` : '';

    setRpmHistory((prev) => {
      const next = [...prev, data.rpm];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
    setTempHistory((prev) => {
      const next = [...prev, data.coolantTemp];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
    setFuelHistory((prev) => {
      const next = [...prev, data.fuelLevel];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
    setTimeLabels((prev) => {
      const next = [...prev, label];
      return next.length > MAX_DATA_POINTS ? next.slice(-MAX_DATA_POINTS) : next;
    });
  }, []);

  useEffect(() => {
    const poll = () => {
      if (isConnected && OBDService.isConnected) {
        intervalRef.current = setInterval(async () => {
          const data = await OBDService.getSensorData();
          if (data) addDataPoint(data);
        }, 2000);
      } else {
        intervalRef.current = setInterval(() => {
          addDataPoint({
            rpm: Math.floor(Math.random() * 3000) + 800,
            coolantTemp: Math.floor(Math.random() * 30) + 75,
            fuelLevel: Math.max(30, Math.floor(100 - tickRef.current * 0.5 + Math.random() * 5)),
          });
        }, 2000);
      }
    };
    poll();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, addDataPoint]);

  const getStats = (data) => {
    if (data.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
    return { min, max, avg };
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'rpm': return rpmHistory;
      case 'temperature': return tempHistory;
      case 'fuel': return fuelHistory;
      default: return [];
    }
  };

  const getChartLabel = () => {
    switch (activeTab) {
      case 'rpm': return { title: 'Engine RPM Over Time', unit: 'RPM', description: 'Monitor engine revolutions per minute in real-time.' };
      case 'temperature': return { title: 'Coolant Temperature Trend', unit: '°C', description: 'Track coolant temperature to detect overheating early.' };
      case 'fuel': return { title: 'Fuel Level Tracking', unit: '%', description: 'Observe fuel consumption patterns over your driving session.' };
      default: return { title: '', unit: '', description: '' };
    }
  };

  const activeData = getActiveData();
  const stats = getStats(activeData);
  const { title, unit, description } = getChartLabel();
  const accentColor = TAB_COLORS[activeTab];
  const chartData = activeData.length >= 2 ? activeData : [0, 0];
  const labels = timeLabels.length >= 2 ? timeLabels : ['', ''];

  // Show only a subset of labels so they don't overlap
  const displayLabels = labels.map((l, i) => (i % 4 === 0 ? l : ''));

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

          <Text style={styles.headerTitle}>Data Charts</Text>

          <View style={[styles.statusBadge, {
            backgroundColor: isConnected && OBDService.isConnected ? '#10B981' : '#F59E0B'
          }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>
              {isConnected && OBDService.isConnected ? 'LIVE' : 'SIM'}
            </Text>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  isActive && { backgroundColor: TAB_COLORS[tab.key], borderColor: TAB_COLORS[tab.key] },
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={isActive ? '#FFFFFF' : '#6B7280'}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Chart Title Card */}
          <View style={styles.chartTitleCard}>
            <View style={[styles.chartTitleBorder, { backgroundColor: accentColor }]} />
            <View style={styles.chartTitleRow}>
              <Ionicons name="analytics" size={22} color={accentColor} />
              <Text style={styles.chartTitle}>{title}</Text>
            </View>
            <Text style={styles.chartDescription}>{description}</Text>
          </View>

          {/* Chart */}
          <View style={styles.chartCard}>
            <View style={[styles.chartCardBorder, { backgroundColor: accentColor }]} />
            {activeData.length >= 2 ? (
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
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                fromZero={activeTab === 'fuel'}
                segments={4}
              />
            ) : (
              <View style={styles.chartPlaceholder}>
                <Ionicons name="bar-chart-outline" size={48} color="#D1D5DB" />
                <Text style={styles.chartPlaceholderText}>Collecting data...</Text>
                <Text style={styles.chartPlaceholderSubtext}>
                  Chart will appear after a few seconds
                </Text>
              </View>
            )}
          </View>

          {/* Stats Cards */}
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color="#1F2937" />
            <Text style={styles.sectionTitle}>Session Statistics</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="arrow-down" size={18} color="#10B981" />
              </View>
              <Text style={styles.statLabel}>Minimum</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {stats.min}
              </Text>
              <Text style={styles.statUnit}>{unit}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: accentColor + '20' }]}>
                <Ionicons name="remove" size={18} color={accentColor} />
              </View>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={[styles.statValue, { color: accentColor }]}>
                {stats.avg}
              </Text>
              <Text style={styles.statUnit}>{unit}</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#EF444420' }]}>
                <Ionicons name="arrow-up" size={18} color="#EF4444" />
              </View>
              <Text style={styles.statLabel}>Maximum</Text>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>
                {stats.max}
              </Text>
              <Text style={styles.statUnit}>{unit}</Text>
            </View>
          </View>

          {/* Data Points Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="ellipsis-horizontal-circle" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Data Points Collected</Text>
              </View>
              <Text style={styles.infoValue}>{activeData.length}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="time-outline" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Sampling Rate</Text>
              </View>
              <Text style={styles.infoValue}>Every 2s</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="layers-outline" size={20} color="#6B7280" />
                <Text style={styles.infoLabel}>Max Buffer Size</Text>
              </View>
              <Text style={styles.infoValue}>{MAX_DATA_POINTS}</Text>
            </View>
          </View>

          {/* Threshold Warning for Temperature */}
          {activeTab === 'temperature' && stats.max > 0 && (
            <View style={[styles.thresholdCard, {
              borderColor: stats.max > 105 ? '#EF4444' : stats.max > 95 ? '#F59E0B' : '#10B981',
              backgroundColor: stats.max > 105 ? '#FEF2F2' : stats.max > 95 ? '#FFFBEB' : '#ECFDF5',
            }]}>
              <Ionicons
                name={stats.max > 105 ? 'alert-circle' : stats.max > 95 ? 'warning' : 'checkmark-circle'}
                size={22}
                color={stats.max > 105 ? '#EF4444' : stats.max > 95 ? '#F59E0B' : '#10B981'}
              />
              <View style={styles.thresholdTextContainer}>
                <Text style={[styles.thresholdTitle, {
                  color: stats.max > 105 ? '#991B1B' : stats.max > 95 ? '#92400E' : '#065F46',
                }]}>
                  {stats.max > 105 ? 'Critical Temperature!'
                    : stats.max > 95 ? 'Temperature Warning'
                    : 'Temperature Normal'}
                </Text>
                <Text style={[styles.thresholdSubtitle, {
                  color: stats.max > 105 ? '#DC2626' : stats.max > 95 ? '#B45309' : '#047857',
                }]}>
                  {stats.max > 105 ? 'Engine may overheat. Check cooling system.'
                    : stats.max > 95 ? 'Approaching high temperature threshold (105°C).'
                    : 'All readings within safe operating range.'}
                </Text>
              </View>
            </View>
          )}

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

  // Tab Selector
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Chart Title Card
  chartTitleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  chartTitleBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  chartDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  // Chart Card
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  chart: {
    borderRadius: 12,
    marginTop: 8,
  },
  chartPlaceholder: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 12,
  },
  chartPlaceholderSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Info Card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  // Threshold Card
  thresholdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  thresholdTextContainer: {
    flex: 1,
  },
  thresholdTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  thresholdSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
