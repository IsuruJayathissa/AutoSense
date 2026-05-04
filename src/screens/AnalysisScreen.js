import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import InspectionService from '../services/InspectionService';
import {
  INSPECTION_SECTIONS,
  STATUS_META,
} from '../data/inspectionChecklist';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40; // padding 20 each side

// Severity ranking for change-detection
const RANK = { na: -1, green: 0, yellow: 1, red: 2 };

// Build a fast lookup: itemId -> { label, sectionTitle, sectionId }
const ITEM_LOOKUP = (() => {
  const map = {};
  INSPECTION_SECTIONS.forEach((section) => {
    section.items.forEach((item) => {
      map[item.id] = {
        label: item.label,
        sectionTitle: section.title,
        sectionId: section.id,
      };
    });
  });
  return map;
})();

// ─── Analysis helpers ────────────────────────────────────────────────────────
function tsOf(insp) {
  return insp?.createdAt?.toMillis ? insp.createdAt.toMillis() : 0;
}

// Section-level counts for one inspection
function sectionBreakdown(inspection) {
  return INSPECTION_SECTIONS.map((section) => {
    const counts = { green: 0, yellow: 0, red: 0, na: 0 };
    section.items.forEach((item) => {
      const status = inspection?.results?.[item.id]?.status || 'na';
      if (counts[status] != null) counts[status] += 1;
    });
    return { id: section.id, title: section.title, total: section.items.length, ...counts };
  });
}

// Diff between latest and previous inspection
function compareInspections(latest, previous) {
  const improved = [];
  const worse = [];
  const unchanged = [];
  if (!latest || !previous) return { improved, worse, unchanged };

  Object.keys(ITEM_LOOKUP).forEach((itemId) => {
    const newStatus = latest.results?.[itemId]?.status || 'na';
    const oldStatus = previous.results?.[itemId]?.status || 'na';
    const r1 = RANK[oldStatus];
    const r2 = RANK[newStatus];
    if (r1 < 0 || r2 < 0) return; // skip not-inspected on either side
    const entry = {
      id: itemId,
      label: ITEM_LOOKUP[itemId].label,
      sectionTitle: ITEM_LOOKUP[itemId].sectionTitle,
      from: oldStatus,
      to: newStatus,
    };
    if (r2 < r1) improved.push(entry);
    else if (r2 > r1) worse.push(entry);
    else unchanged.push(entry);
  });

  return { improved, worse, unchanged };
}

// Top recurring problems across ALL inspections
function recurringIssues(inspections, topN = 10) {
  const counts = {};
  inspections.forEach((ins) => {
    if (!ins.results) return;
    Object.entries(ins.results).forEach(([itemId, r]) => {
      if (r.status === 'red' || r.status === 'yellow') {
        counts[itemId] = counts[itemId] || { red: 0, yellow: 0, total: 0 };
        counts[itemId][r.status] += 1;
        counts[itemId].total += 1;
      }
    });
  });

  return Object.entries(counts)
    .map(([id, c]) => ({
      id,
      label: ITEM_LOOKUP[id]?.label || id,
      sectionTitle: ITEM_LOOKUP[id]?.sectionTitle || '',
      ...c,
    }))
    .sort((a, b) => {
      if (b.red !== a.red) return b.red - a.red;
      return b.total - a.total;
    })
    .slice(0, topN);
}

// Health-score trend points for the line chart
function healthTrend(inspections) {
  // inspections come in newest-first; chart wants oldest-first
  const sorted = [...inspections]
    .filter((i) => i.healthScore != null)
    .sort((a, b) => tsOf(a) - tsOf(b));

  const labels = sorted.map((i) => {
    const d = i.createdAt?.toDate ? i.createdAt.toDate() : new Date();
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const data = sorted.map((i) => i.healthScore);
  const best = data.length ? Math.max(...data) : null;
  const worst = data.length ? Math.min(...data) : null;
  const last = data.length ? data[data.length - 1] : null;
  return { labels, data, best, worst, last, count: data.length };
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function AnalysisScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inspections, setInspections] = useState([]);

  const load = useCallback(async () => {
    try {
      const docs = await InspectionService.listInspections();
      setInspections(docs);
    } catch (e) {
      console.warn('AnalysisScreen: load error', e.message);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const trend = useMemo(() => healthTrend(inspections), [inspections]);
  const latest = inspections[0] || null;
  const previous = inspections[1] || null;
  const breakdown = useMemo(() => latest ? sectionBreakdown(latest) : [], [latest]);
  const diff = useMemo(() => compareInspections(latest, previous), [latest, previous]);
  const recurring = useMemo(() => recurringIssues(inspections), [inspections]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#8B0000" />
        <Text style={styles.loadingText}>Analyzing your inspections…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle Analysis</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#8B0000']} />
          }
        >
          {/* Empty state */}
          {inspections.length === 0 ? (
            <EmptyState navigation={navigation} />
          ) : (
            <>
              {/* Top summary */}
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.summaryCard}
              >
                <Text style={styles.summaryTitle}>Based on {inspections.length} inspection{inspections.length === 1 ? '' : 's'}</Text>
                <View style={styles.summaryRow}>
                  <SummaryStat value={trend.last ?? '—'} label="Latest Score" />
                  <SummaryStat value={trend.best ?? '—'} label="Best" />
                  <SummaryStat value={trend.worst ?? '—'} label="Worst" />
                </View>
              </LinearGradient>

              {/* 1. Health Trend Chart */}
              <SectionTitle icon="trending-up-outline" title="Engine Health Trend" />
              {trend.count >= 2 ? (
                <View style={styles.chartCard}>
                  <LineChart
                    data={{
                      labels: trend.labels,
                      datasets: [{ data: trend.data, strokeWidth: 3 }],
                    }}
                    width={CHART_WIDTH}
                    height={200}
                    yAxisSuffix=""
                    fromZero
                    chartConfig={{
                      backgroundColor: '#FFFFFF',
                      backgroundGradientFrom: '#FFFFFF',
                      backgroundGradientTo: '#FFFFFF',
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(139, 0, 0, ${opacity})`,
                      labelColor: () => '#6B7280',
                      propsForDots: { r: '5', strokeWidth: '2', stroke: '#8B0000' },
                      propsForBackgroundLines: { stroke: '#F3F4F6' },
                    }}
                    bezier
                    style={{ borderRadius: 12, paddingRight: 16 }}
                  />
                  <Text style={styles.chartCaption}>Score over time (0 = critical, 100 = excellent)</Text>
                </View>
              ) : (
                <InfoCard
                  icon="information-circle-outline"
                  text={`Need at least 2 inspections to draw a trend. You have ${trend.count}.`}
                />
              )}

              {/* 2. Section Breakdown */}
              <SectionTitle icon="pie-chart-outline" title="Section Health (Latest)" />
              <View style={styles.cardWhite}>
                {breakdown.map((s) => (
                  <SectionBar key={s.id} section={s} />
                ))}
              </View>

              {/* 3. Latest vs Previous */}
              <SectionTitle icon="git-compare-outline" title="Latest vs Previous" />
              {previous ? (
                <View style={styles.cardWhite}>
                  <DiffSummary diff={diff} />
                  <DiffList title="Improved" items={diff.improved} color="#10B981" icon="arrow-up-circle" />
                  <DiffList title="Got Worse" items={diff.worse} color="#EF4444" icon="arrow-down-circle" />
                </View>
              ) : (
                <InfoCard
                  icon="information-circle-outline"
                  text="Need a second inspection to compare. Run another to see what changed."
                />
              )}

              {/* 4. Recurring Issues */}
              <SectionTitle icon="warning-outline" title="Recurring Issues" />
              {recurring.length > 0 ? (
                <View style={styles.cardWhite}>
                  {recurring.map((item, idx) => (
                    <RecurringRow key={item.id} rank={idx + 1} item={item} totalInspections={inspections.length} />
                  ))}
                </View>
              ) : (
                <InfoCard
                  icon="checkmark-circle-outline"
                  text="🎉 No recurring problems detected across your inspections."
                />
              )}

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function EmptyState({ navigation }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name="analytics-outline" size={56} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Inspections to Analyze</Text>
      <Text style={styles.emptyText}>
        Save at least one Vehicle Inspection from the Home screen to see analysis here.
        Two or more inspections unlock trend & comparison views.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => navigation.navigate('Inspection')}
        activeOpacity={0.85}
      >
        <Ionicons name="clipboard-outline" size={16} color="#FFFFFF" />
        <Text style={styles.emptyBtnText}>Start an Inspection</Text>
      </TouchableOpacity>
    </View>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={18} color="#8B0000" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SummaryStat({ value, label }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SectionBar({ section }) {
  const total = section.total;
  // Bar parts (skip 'na' from coloured bar — show separately as label)
  const inspected = section.green + section.yellow + section.red;
  const greenPct  = total ? (section.green  / total) * 100 : 0;
  const yellowPct = total ? (section.yellow / total) * 100 : 0;
  const redPct    = total ? (section.red    / total) * 100 : 0;
  const naPct     = total ? (section.na     / total) * 100 : 0;

  return (
    <View style={styles.sectionBar}>
      <View style={styles.sectionBarHeader}>
        <Text style={styles.sectionBarTitle}>{section.title}</Text>
        <Text style={styles.sectionBarCount}>
          {inspected}/{total} inspected
        </Text>
      </View>
      <View style={styles.bar}>
        {greenPct  > 0 && <View style={[styles.barSeg, { backgroundColor: '#10B981', width: `${greenPct}%`  }]} />}
        {yellowPct > 0 && <View style={[styles.barSeg, { backgroundColor: '#F59E0B', width: `${yellowPct}%` }]} />}
        {redPct    > 0 && <View style={[styles.barSeg, { backgroundColor: '#EF4444', width: `${redPct}%`    }]} />}
        {naPct     > 0 && <View style={[styles.barSeg, { backgroundColor: '#E5E7EB', width: `${naPct}%`     }]} />}
      </View>
      <View style={styles.sectionBarLegend}>
        {section.green  > 0 && <LegendDot color="#10B981" text={`${section.green} good`} />}
        {section.yellow > 0 && <LegendDot color="#F59E0B" text={`${section.yellow} monitor`} />}
        {section.red    > 0 && <LegendDot color="#EF4444" text={`${section.red} action`} />}
      </View>
    </View>
  );
}

function LegendDot({ color, text }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

function DiffSummary({ diff }) {
  return (
    <View style={styles.diffSummaryRow}>
      <DiffPill icon="arrow-up"   color="#10B981" count={diff.improved.length}  label="Improved" />
      <DiffPill icon="arrow-down" color="#EF4444" count={diff.worse.length}     label="Got Worse" />
      <DiffPill icon="remove"     color="#9CA3AF" count={diff.unchanged.length} label="Unchanged" />
    </View>
  );
}

function DiffPill({ icon, color, count, label }) {
  return (
    <View style={[styles.diffPill, { borderColor: color }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.diffPillNum, { color }]}>{count}</Text>
      <Text style={styles.diffPillLabel}>{label}</Text>
    </View>
  );
}

function DiffList({ title, items, color, icon }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.diffList}>
      <View style={styles.diffListHead}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.diffListTitle, { color }]}>{title} ({items.length})</Text>
      </View>
      {items.slice(0, 5).map((it) => {
        const fromMeta = STATUS_META[it.from];
        const toMeta = STATUS_META[it.to];
        return (
          <View key={it.id} style={styles.diffItem}>
            <Text style={styles.diffItemLabel}>{it.label}</Text>
            <View style={styles.diffItemArrow}>
              <View style={[styles.statusDotSmall, { backgroundColor: fromMeta.color }]} />
              <Ionicons name="arrow-forward" size={11} color="#9CA3AF" />
              <View style={[styles.statusDotSmall, { backgroundColor: toMeta.color }]} />
            </View>
          </View>
        );
      })}
      {items.length > 5 && (
        <Text style={styles.diffMore}>+ {items.length - 5} more</Text>
      )}
    </View>
  );
}

function RecurringRow({ rank, item, totalInspections }) {
  const ratio = totalInspections > 0 ? Math.round((item.total / totalInspections) * 100) : 0;
  const dominantColor = item.red > 0 ? '#EF4444' : '#F59E0B';
  return (
    <View style={styles.recurringRow}>
      <View style={[styles.rankBadge, { backgroundColor: dominantColor }]}>
        <Text style={styles.rankText}>#{rank}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recurringLabel} numberOfLines={2}>{item.label}</Text>
        <Text style={styles.recurringSection}>{item.sectionTitle}</Text>
      </View>
      <View style={styles.recurringStats}>
        {item.red > 0 && (
          <View style={styles.recurringChip}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.recurringChipText}>{item.red}×</Text>
          </View>
        )}
        {item.yellow > 0 && (
          <View style={styles.recurringChip}>
            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.recurringChipText}>{item.yellow}×</Text>
          </View>
        )}
        <Text style={styles.recurringRatio}>{ratio}%</Text>
      </View>
    </View>
  );
}

function InfoCard({ icon, text }) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={20} color="#8B0000" />
      <Text style={styles.infoCardText}>{text}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safe: { flex: 1 },
  loadingScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFFFFF', gap: 12,
  },
  loadingText: { color: '#6B7280', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  // Summary card
  summaryCard: { borderRadius: 16, padding: 18, marginBottom: 16 },
  summaryTitle: { color: '#FECACA', fontSize: 12, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  summaryLabel: { color: '#FECACA', fontSize: 11, marginTop: 2 },

  // Section title
  sectionTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, marginBottom: 8, paddingHorizontal: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1F2937', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Generic white card
  cardWhite: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 8, paddingTop: 14,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  chartCaption: { fontSize: 11, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  // Info / empty cards
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FEE2E2',
  },
  infoCardText: { flex: 1, fontSize: 13, color: '#8B0000', lineHeight: 18 },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#8B0000', paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Section bar
  sectionBar: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sectionBarTitle: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  sectionBarCount: { fontSize: 11, color: '#9CA3AF' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  barSeg: { height: 8 },
  sectionBarLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#6B7280' },

  // Diff
  diffSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  diffPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  diffPillNum: { fontSize: 16, fontWeight: '800' },
  diffPillLabel: { fontSize: 10, color: '#6B7280', fontWeight: '600' },

  diffList: { marginTop: 8 },
  diffListHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  diffListTitle: { fontSize: 13, fontWeight: '700' },
  diffItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, paddingHorizontal: 8,
    backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 4,
  },
  diffItemLabel: { fontSize: 12, color: '#1F2937', flex: 1, paddingRight: 8 },
  diffItemArrow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDotSmall: { width: 10, height: 10, borderRadius: 5 },
  diffMore: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 4, textAlign: 'center' },

  // Recurring issues
  recurringRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  rankBadge: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  recurringLabel: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  recurringSection: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  recurringStats: { alignItems: 'flex-end', gap: 4 },
  recurringChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recurringChipText: { fontSize: 11, fontWeight: '700', color: '#1F2937' },
  recurringRatio: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
});
