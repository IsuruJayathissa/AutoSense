import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ReportService from '../services/ReportService';
import {
  INSPECTION_SECTIONS,
  ECU_REPORT_FIELDS,
  STATUS_META,
} from '../data/inspectionChecklist';

function formatDate(val) {
  if (!val) return '—';
  const d = val.toDate ? val.toDate() : new Date(val);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return typeof v === 'number'
    ? (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1))
    : String(v);
}

export default function InspectionDetailScreen({ navigation, route }) {
  const item = route.params?.inspection;
  const [sharing, setSharing] = useState(false);
  const [sharingText, setSharingText] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);

  if (!item) {
    return (
      <View style={styles.errorScreen}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={styles.errorText}>Inspection not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = item.summary || { green: 0, yellow: 0, red: 0, na: 0, total: 0 };
  const accent = s.red > 0 ? '#EF4444' : s.yellow > 0 ? '#F59E0B' : '#10B981';
  const accentLabel = s.red > 0 ? 'Action Needed' : s.yellow > 0 ? 'Monitor' : 'Good';

  // Build the data payload that ReportService methods expect
  const buildPayload = () => ({
    vehicle: {
      vehicleId:     item.vehicleId,
      vehicleNumber: item.vehicleNumber,
      brand:         item.brand,
      model:         item.model,
      year:          item.year,
      engineType:    item.engineType,
    },
    inspectorName: item.inspectorName,
    odometer:      item.odometer,
    results:       item.results,
    ecuSnapshot:   item.ecuSnapshot,
    healthScore:   item.healthScore,
    faultCodes:    item.faultCodes || [],
    notes:         item.notes,
    timestamp:     item.createdAt?.toMillis ? item.createdAt.toMillis() : Date.now(),
  });

  const handleShare = async () => {
    setSharing(true);
    try {
      await ReportService.exportInspectionPDF(buildPayload());
    } catch (e) {
      Alert.alert('Share Failed', e.message);
    } finally {
      setSharing(false);
    }
  };

  const handleShareAsText = async () => {
    setSharingText(true);
    try {
      await ReportService.shareInspectionAsText(buildPayload());
    } catch (e) {
      Alert.alert('Share Failed', e.message);
    } finally {
      setSharingText(false);
    }
  };

  const handleSendWhatsAppText = async () => {
    setSharingWhatsApp(true);
    try {
      await ReportService.sendInspectionTextToWhatsApp(buildPayload());
    } catch (e) {
      Alert.alert('WhatsApp Failed', e.message);
    } finally {
      setSharingWhatsApp(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inspection Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Status banner */}
          <LinearGradient
            colors={[accent, accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.statusBanner}
          >
            <Text style={styles.statusBannerLabel}>Overall Status</Text>
            <Text style={styles.statusBannerValue}>{accentLabel}</Text>
            {item.healthScore != null && (
              <Text style={styles.statusBannerScore}>Engine Health: {item.healthScore}/100</Text>
            )}
          </LinearGradient>

          {/* Vehicle / inspector / date / odometer */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inspection Info</Text>
            <DetailRow icon="car-sport-outline"  label="Vehicle"   value={`${item.brand || '—'} ${item.model || ''}`.trim()} />
            <DetailRow icon="card-outline"       label="Number"    value={item.vehicleNumber || '—'} />
            <DetailRow icon="calendar-outline"   label="Year"      value={item.year || '—'} />
            <DetailRow icon="hardware-chip-outline" label="Engine" value={item.engineType || '—'} />
            <DetailRow icon="person-outline"     label="Inspector" value={item.inspectorName || '—'} />
            <DetailRow icon="speedometer-outline" label="Odometer" value={item.odometer ? `${item.odometer} km` : '—'} />
            <DetailRow icon="time-outline"       label="Date"      value={formatDate(item.createdAt)} />
          </View>

          {/* Summary tiles */}
          <View style={styles.summaryGrid}>
            <SummaryTile color="#10B981" value={s.green}  label="Good" />
            <SummaryTile color="#F59E0B" value={s.yellow} label="Monitor" />
            <SummaryTile color="#EF4444" value={s.red}    label="Action" />
            <SummaryTile color="#9CA3AF" value={s.na}     label="N/A" />
          </View>

          {/* Inspection sections */}
          {INSPECTION_SECTIONS.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              results={item.results || {}}
            />
          ))}

          {/* ECU snapshot */}
          {item.ecuSnapshot && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>ECU Snapshot</Text>
              {ECU_REPORT_FIELDS.map((f) => {
                const v = item.ecuSnapshot[f.id];
                if (v == null || isNaN(v)) return null;
                return (
                  <View key={f.id} style={styles.ecuRow}>
                    <Text style={styles.ecuLabel}>{f.label}</Text>
                    <Text style={styles.ecuValue}>{fmt(v)}{f.unit}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* DTCs */}
          {(item.faultCodes || []).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Fault Codes ({item.faultCodes.length})</Text>
              {item.faultCodes.map((f, idx) => (
                <View key={idx} style={styles.dtcRow}>
                  <View style={styles.dtcCodeBadge}>
                    <Text style={styles.dtcCodeText}>{f.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dtcDesc}>{f.description}</Text>
                    {f.severity && (
                      <Text style={[styles.dtcSeverity, { color: f.severity === 'Critical' ? '#EF4444' : f.severity === 'Warning' ? '#F59E0B' : '#10B981' }]}>
                        {f.severity}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* General notes */}
          {!!item.notes && (
            <View style={styles.notesCard}>
              <View style={styles.notesHead}>
                <Ionicons name="document-text-outline" size={18} color="#F59E0B" />
                <Text style={styles.notesTitle}>General Notes</Text>
              </View>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}

          {/* Share as text — works in Expo Go without files */}
          <TouchableOpacity
            style={styles.textShareBtn}
            onPress={handleShareAsText}
            disabled={sharingText}
            activeOpacity={0.85}
          >
            {sharingText ? (
              <ActivityIndicator color="#1F2937" size="small" />
            ) : (
              <>
                <Ionicons name="chatbox-outline" size={18} color="#1F2937" />
                <Text style={styles.textShareBtnText}>Share as Text</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Send to WhatsApp as text */}
          <TouchableOpacity
            style={styles.whatsappTextBtn}
            onPress={handleSendWhatsAppText}
            disabled={sharingWhatsApp}
            activeOpacity={0.85}
          >
            {sharingWhatsApp ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                <Text style={styles.whatsappTextBtnText}>Send Text to WhatsApp</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Re-share as PDF/HTML file */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8B0000', '#A00000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareBtnGradient}
            >
              {sharing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="document-attach-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>Share as File (PDF / HTML)</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={15} color="#6B7280" />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function SummaryTile({ color, value, label }) {
  return (
    <View style={[styles.summaryTile, { borderColor: `${color}40`, backgroundColor: `${color}10` }]}>
      <Text style={[styles.summaryTileNum, { color }]}>{value}</Text>
      <Text style={styles.summaryTileLabel}>{label}</Text>
    </View>
  );
}

function SectionBlock({ section, results }) {
  // Count statuses for this section
  const counts = section.items.reduce((acc, item) => {
    const status = results[item.id]?.status || 'na';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { green: 0, yellow: 0, red: 0, na: 0 });

  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionHeadLeft}>
          <View style={styles.sectionIconCircle}>
            <Ionicons name={section.icon} size={18} color="#8B0000" />
          </View>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
        <Text style={styles.sectionCount}>
          {counts.green}🟢 {counts.yellow}🟡 {counts.red}🔴
        </Text>
      </View>

      {section.items.map((item) => {
        const r = results[item.id] || { status: 'na', notes: '' };
        const meta = STATUS_META[r.status] || STATUS_META.na;
        return (
          <View key={item.id} style={styles.itemRow}>
            <View style={[styles.itemDot, { backgroundColor: meta.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              {!!r.notes && <Text style={styles.itemNotes}>📝 {r.notes}</Text>}
            </View>
            <View style={[styles.itemPill, { backgroundColor: `${meta.color}20`, borderColor: meta.color }]}>
              <Text style={[styles.itemPillText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safe: { flex: 1 },

  errorScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFFFFF', gap: 12,
  },
  errorText: { color: '#6B7280', fontSize: 15 },
  errorBtn: { marginTop: 16, backgroundColor: '#8B0000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  errorBtnText: { color: '#FFFFFF', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  scrollContent: { padding: 16 },

  // Status banner
  statusBanner: {
    borderRadius: 14, padding: 18, marginBottom: 14, alignItems: 'center',
  },
  statusBannerLabel: { color: '#FFFFFF', opacity: 0.85, fontSize: 12, marginBottom: 4 },
  statusBannerValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  statusBannerScore: { color: '#FFFFFF', opacity: 0.9, fontSize: 13, marginTop: 6, fontWeight: '600' },

  // Generic card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Detail row (vehicle info)
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, color: '#1F2937', fontWeight: '600', maxWidth: '55%' },

  // Summary tiles
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryTile: {
    flex: 1, alignItems: 'center', borderRadius: 10,
    padding: 12, borderWidth: 1,
  },
  summaryTileNum: { fontSize: 22, fontWeight: '800' },
  summaryTileLabel: { fontSize: 10, color: '#6B7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Section block
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sectionIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  sectionCount: { fontSize: 11, color: '#6B7280' },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
  },
  itemDot: { width: 8, height: 8, borderRadius: 4 },
  itemLabel: { fontSize: 13, color: '#1F2937' },
  itemNotes: { fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 2 },
  itemPill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  itemPillText: { fontSize: 10, fontWeight: '700' },

  // ECU
  ecuRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  ecuLabel: { fontSize: 13, color: '#374151' },
  ecuValue: { fontSize: 13, color: '#1F2937', fontWeight: '700' },

  // DTC
  dtcRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dtcCodeBadge: { backgroundColor: '#1F2937', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dtcCodeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  dtcDesc: { fontSize: 13, color: '#1F2937' },
  dtcSeverity: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  // Notes
  notesCard: {
    backgroundColor: '#FFFBEB', borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    borderRadius: 10, padding: 14, marginBottom: 12,
  },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  notesTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  notesText: { fontSize: 13, color: '#374151', lineHeight: 18 },

  // Share buttons
  textShareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#1F2937',
    marginTop: 6, marginBottom: 10,
  },
  textShareBtnText: { color: '#1F2937', fontWeight: '700', fontSize: 14 },

  whatsappTextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#25D366',
    marginBottom: 10,
  },
  whatsappTextBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  shareBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 6 },
  shareBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16,
  },
  shareBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
