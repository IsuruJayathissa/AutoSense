import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import OBDService from '../services/OBDService';
import InspectionService from '../services/InspectionService';
import ReportService from '../services/ReportService';
import {
  INSPECTION_SECTIONS,
  buildEmptyResults,
  summarizeResults,
  STATUS_META,
} from '../data/inspectionChecklist';

const STATUS_ORDER = ['green', 'yellow', 'red', 'na'];

// Quick rule-based engine health score from a single ECU snapshot.
// Mirrors the logic in EngineHealthScreen but condensed for one reading.
function scoreEngineHealth(snapshot) {
  if (!snapshot) return null;
  let score = 100;
  const issues = [];

  if (snapshot.coolantTemp != null) {
    if (snapshot.coolantTemp > 105) { score -= 25; issues.push('Coolant temperature very high'); }
    else if (snapshot.coolantTemp > 95) { score -= 10; issues.push('Coolant temperature elevated'); }
  }
  if (snapshot.engineLoad != null && snapshot.engineLoad > 85) {
    score -= 10; issues.push('Engine load very high');
  }
  if (snapshot.voltage != null) {
    if (snapshot.voltage < 11.5) { score -= 20; issues.push('Battery voltage low'); }
    else if (snapshot.voltage > 15.0) { score -= 10; issues.push('Charging voltage high'); }
  }
  if (snapshot.maf != null && snapshot.rpm > 0) {
    const ratio = snapshot.maf / snapshot.rpm;
    if (ratio < 0.002 || ratio > 0.020) { score -= 10; issues.push('MAF/RPM ratio outside healthy band'); }
  }
  return { score: Math.max(0, score), issues };
}

export default function InspectionScreen({ navigation }) {
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  // Header fields
  const [inspectorName, setInspectorName] = useState('');
  const [odometer, setOdometer] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');

  // Per-item results: { [itemId]: { status, notes } }
  const [results, setResults] = useState(buildEmptyResults());

  // ECU snapshot (filled when user taps "Pull from OBD")
  const [ecuSnapshot, setEcuSnapshot] = useState(null);
  const [faultCodes, setFaultCodes] = useState([]);
  const [pullingObd, setPullingObd] = useState(false);
  const [obdConnected, setObdConnected] = useState(OBDService.isConnected);

  // Submission state
  const [saving, setSaving] = useState(false);
  const [sharingTextWhatsApp, setSharingTextWhatsApp] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState('');

  useEffect(() => {
    loadVehicle();
    const unsubscribe = OBDService.onConnectionChange(setObdConnected);
    return unsubscribe;
  }, []);

  const loadVehicle = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const userVehicleSnap = await getDoc(doc(db, 'userVehicles', userId));
      if (userVehicleSnap.exists()) {
        const vehicleId = userVehicleSnap.data().vehicleId;
        if (vehicleId) {
          const vehicleSnap = await getDoc(doc(db, 'vehicles', vehicleId));
          if (vehicleSnap.exists()) setVehicle(vehicleSnap.data());
        }
      }
    } catch (err) {
      console.error('Inspection: vehicle load failed', err);
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => summarizeResults(results), [results]);

  const setItemStatus = (itemId, status) => {
    setResults((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { notes: '' }), status },
    }));
  };

  const setItemNotes = (itemId, notes) => {
    setResults((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || { status: 'na' }), notes },
    }));
  };

  // ── Pull live ECU snapshot ───────────────────────────────────────────────
  const handlePullFromObd = async () => {
    if (!OBDService.isConnected) {
      Alert.alert(
        'OBD Not Connected',
        'Connect to your ELM327 adapter first to pull live ECU data.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect', onPress: () => navigation.navigate('OBDConnection') },
        ]
      );
      return;
    }

    setPullingObd(true);
    try {
      const sensors = await OBDService.getSensorData();
      let dtcs = [];
      try {
        dtcs = await OBDService.getFaultCodes(vehicle?.brand);
      } catch (e) {
        // DTC retrieval failure shouldn't abort the snapshot
        console.warn('DTC pull failed:', e?.message);
      }
      setEcuSnapshot(sensors);
      setFaultCodes(dtcs || []);
      Alert.alert('ECU Snapshot Captured', 'Live sensor data has been added to this inspection.');
    } catch (err) {
      Alert.alert('OBD Read Failed', err?.message || 'Could not read sensor data.');
    } finally {
      setPullingObd(false);
    }
  };

  // ── Save inspection to Firestore ─────────────────────────────────────────
  const persistInspection = async () => {
    const health = scoreEngineHealth(ecuSnapshot);
    return InspectionService.saveInspection({
      vehicle,
      inspectorName,
      odometer,
      results,
      ecuSnapshot,
      healthScore: health?.score ?? null,
      faultCodes,
      notes: generalNotes,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistInspection();
      Alert.alert('Saved', 'Inspection saved to your records.');
    } catch (err) {
      Alert.alert('Save Failed', err?.message || 'Could not save inspection.');
    } finally {
      setSaving(false);
    }
  };

  // ── Build the payload used for WhatsApp text export ─────────────────────
  const buildTextPayload = () => {
    const health = scoreEngineHealth(ecuSnapshot);
    return {
      vehicle,
      inspectorName,
      odometer,
      results,
      ecuSnapshot,
      healthScore: health?.score ?? null,
      faultCodes,
      notes: generalNotes,
    };
  };

  const handleSendTextWhatsApp = async () => {
    setSharingTextWhatsApp(true);
    try {
      await persistInspection();
      await ReportService.sendInspectionTextToWhatsApp(
        buildTextPayload(),
        recipientPhone
      );
    } catch (err) {
      Alert.alert('WhatsApp Failed', err?.message || 'Could not open WhatsApp.');
    } finally {
      setSharingTextWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B0000" />
        <Text style={styles.loadingText}>Loading inspection...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Vehicle Inspection</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Summary Card */}
          <LinearGradient
            colors={['#8B0000', '#A00000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryTitle}>Inspection Summary</Text>
            <Text style={styles.summarySubtitle}>
              {vehicle ? `${vehicle.brand} ${vehicle.model} • ${vehicle.vehicleNumber}` : 'No vehicle'}
            </Text>
            <View style={styles.summaryRow}>
              <SummaryStat color="#10B981" value={summary.green} label="Good" />
              <SummaryStat color="#F59E0B" value={summary.yellow} label="Monitor" />
              <SummaryStat color="#FCA5A5" value={summary.red} label="Action" />
              <SummaryStat color="#E5E7EB" value={summary.na} label="N/A" />
            </View>
          </LinearGradient>

          {/* Header fields */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inspection Details</Text>

            <Text style={styles.fieldLabel}>Inspector Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={inspectorName}
              onChangeText={setInspectorName}
              placeholder="e.g. John (mechanic) or Self"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.fieldLabel}>Odometer Reading (km)</Text>
            <TextInput
              style={styles.fieldInput}
              value={odometer}
              onChangeText={setOdometer}
              placeholder="e.g. 145320"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
            />
          </View>

          {/* Inspection sections */}
          {INSPECTION_SECTIONS.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              results={results}
              onSetStatus={setItemStatus}
              onSetNotes={setItemNotes}
            />
          ))}

          {/* ECU Diagnostics */}
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionHeadLeft}>
                <View style={[styles.sectionIconCircle, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="hardware-chip-outline" size={20} color="#8B0000" />
                </View>
                <Text style={styles.sectionTitle}>ECU Diagnostics</Text>
              </View>
            </View>

            <Text style={styles.helperText}>
              Pulled live from your OBD-II adapter. Tap the button below after connecting.
            </Text>

            <TouchableOpacity
              style={[styles.pullBtn, !obdConnected && styles.pullBtnDisabled]}
              onPress={handlePullFromObd}
              disabled={pullingObd}
              activeOpacity={0.85}
            >
              {pullingObd ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.pullBtnText}>
                    {ecuSnapshot ? 'Pull Again from OBD' : 'Pull from OBD'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {ecuSnapshot ? (
              <View style={styles.ecuTable}>
                <EcuRow label="Engine RPM"          value={ecuSnapshot.rpm}          unit="" />
                <EcuRow label="Vehicle Speed"       value={ecuSnapshot.speed}        unit=" km/h" />
                <EcuRow label="Coolant Temperature" value={ecuSnapshot.coolantTemp}  unit=" °C" />
                <EcuRow label="Engine Load"         value={ecuSnapshot.engineLoad}   unit=" %" />
                <EcuRow label="Throttle Position"   value={ecuSnapshot.throttle}     unit=" %" />
                <EcuRow label="Battery Voltage"     value={ecuSnapshot.voltage}      unit=" V" />
                <EcuRow label="Fuel Level"          value={ecuSnapshot.fuelLevel}    unit=" %" />
                <EcuRow label="Intake Air Temp"     value={ecuSnapshot.intakeTemp}   unit=" °C" />
                <EcuRow label="MAF Airflow"         value={ecuSnapshot.maf}          unit=" g/s" />
                <View style={styles.ecuFooter}>
                  <Ionicons name="information-circle" size={14} color="#6B7280" />
                  <Text style={styles.ecuFooterText}>
                    {faultCodes.length > 0
                      ? `${faultCodes.length} fault code(s) detected`
                      : 'No fault codes detected'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.ecuEmpty}>
                <Ionicons name="cloud-offline-outline" size={28} color="#9CA3AF" />
                <Text style={styles.ecuEmptyText}>No ECU data captured yet</Text>
              </View>
            )}
          </View>

          {/* General notes */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>General Notes</Text>
            <TextInput
              style={[styles.fieldInput, styles.notesArea]}
              value={generalNotes}
              onChangeText={setGeneralNotes}
              placeholder="Optional summary or recommendations for the owner / mechanic..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* ── Send to WhatsApp (improved) ─────────────────────────────── */}
          <View style={styles.whatsappCard}>
            <View style={styles.whatsappCardHeader}>
              <View style={styles.whatsappLogoCircle}>
                <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappCardTitle}>Send Report via WhatsApp</Text>
                <Text style={styles.whatsappCardSubtitle}>
                  The full inspection — health score, fault codes, sensor data, and notes — will be saved and forwarded as a formatted message.
                </Text>
              </View>
            </View>

            <Text style={styles.whatsappPhoneLabel}>
              Recipient phone (optional)
            </Text>
            <View style={styles.whatsappPhoneRow}>
              <Text style={styles.whatsappPhonePrefix}>+</Text>
              <TextInput
                style={styles.whatsappPhoneInput}
                value={recipientPhone}
                onChangeText={setRecipientPhone}
                placeholder="94771234567 (with country code)"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                autoCorrect={false}
              />
              {recipientPhone.length > 0 && (
                <TouchableOpacity onPress={() => setRecipientPhone('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.whatsappPhoneHint}>
              Leave empty to choose a contact in WhatsApp. Include country code without "+".
            </Text>

            <TouchableOpacity
              style={[
                styles.whatsappPrimaryBtn,
                sharingTextWhatsApp && styles.whatsappPrimaryBtnDisabled,
              ]}
              onPress={handleSendTextWhatsApp}
              disabled={sharingTextWhatsApp}
              activeOpacity={0.85}
            >
              {sharingTextWhatsApp ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
                  <Text style={styles.whatsappPrimaryBtnText}>
                    {recipientPhone.replace(/[^\d]/g, '').length >= 7
                      ? 'Send to ' + recipientPhone.replace(/[^\d]/g, '')
                      : 'Send via WhatsApp'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Save (records-only) ──────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#8B0000" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#8B0000" />
                <Text style={styles.secondaryBtnText}>Save Inspection</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function SummaryStat({ color, value, label }) {
  return (
    <View style={styles.summaryStat}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ section, results, onSetStatus, onSetNotes }) {
  const [expanded, setExpanded] = useState(true);
  const sectionSummary = useMemo(() => {
    const ids = section.items.map((i) => i.id);
    const subset = {};
    ids.forEach((id) => { subset[id] = results[id]; });
    return summarizeResults(subset);
  }, [section, results]);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.sectionHead}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeadLeft}>
          <View style={[styles.sectionIconCircle, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name={section.icon} size={20} color="#8B0000" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>
              {sectionSummary.green}🟢 &nbsp; {sectionSummary.yellow}🟡 &nbsp; {sectionSummary.red}🔴 &nbsp; {sectionSummary.na}⚪
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>

      {expanded && section.items.map((item) => (
        <InspectionItem
          key={item.id}
          item={item}
          result={results[item.id] || { status: 'na', notes: '' }}
          onSetStatus={(s) => onSetStatus(item.id, s)}
          onSetNotes={(n) => onSetNotes(item.id, n)}
        />
      ))}
    </View>
  );
}

function InspectionItem({ item, result, onSetStatus, onSetNotes }) {
  const [showNotes, setShowNotes] = useState(false);

  return (
    <View style={styles.itemRow}>
      <Text style={styles.itemLabel}>{item.label}</Text>

      <View style={styles.statusRow}>
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          const active = result.status === status;
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.statusBtn,
                active && { backgroundColor: meta.color, borderColor: meta.color },
              ]}
              onPress={() => onSetStatus(status)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={meta.icon}
                size={16}
                color={active ? '#FFFFFF' : meta.color}
              />
              <Text style={[
                styles.statusBtnText,
                active && { color: '#FFFFFF' },
                !active && { color: meta.color },
              ]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.notesToggle}
        onPress={() => setShowNotes(!showNotes)}
        activeOpacity={0.6}
      >
        <Ionicons
          name={showNotes ? 'remove-circle-outline' : 'add-circle-outline'}
          size={14}
          color="#8B0000"
        />
        <Text style={styles.notesToggleText}>
          {showNotes ? 'Hide notes' : (result.notes ? 'Edit notes' : 'Add notes')}
        </Text>
      </TouchableOpacity>

      {showNotes && (
        <TextInput
          style={[styles.fieldInput, styles.itemNotes]}
          value={result.notes}
          onChangeText={onSetNotes}
          placeholder="Optional notes (e.g. measurement, brand, observation)..."
          placeholderTextColor="#9CA3AF"
          multiline
        />
      )}
    </View>
  );
}

function EcuRow({ label, value, unit }) {
  const display = value == null || isNaN(value)
    ? '—'
    : (typeof value === 'number'
        ? (value % 1 === 0 ? value.toFixed(0) : value.toFixed(1))
        : value);
  return (
    <View style={styles.ecuRow}>
      <Text style={styles.ecuLabel}>{label}</Text>
      <Text style={styles.ecuValue}>{display}{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 14 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  summaryCard: {
    borderRadius: 16, padding: 18, marginBottom: 16,
  },
  summaryTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  summarySubtitle: { color: '#FECACA', fontSize: 13, marginTop: 2, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryStat: { flex: 1, alignItems: 'center' },
  summaryDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  summaryValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: '#FECACA', fontSize: 11, marginTop: 2 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  helperText: { fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 16 },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12, marginBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  sectionIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  sectionSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  itemLabel: { fontSize: 14, color: '#1F2937', fontWeight: '500', marginBottom: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  statusBtnText: { fontSize: 11, fontWeight: '700' },

  notesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  notesToggleText: { fontSize: 12, color: '#8B0000', fontWeight: '600' },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1F2937',
  },
  itemNotes: { marginTop: 8, minHeight: 60, textAlignVertical: 'top' },
  notesArea: { minHeight: 90, textAlignVertical: 'top' },

  pullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#8B0000',
    paddingVertical: 12, borderRadius: 10, marginVertical: 4,
  },
  pullBtnDisabled: { opacity: 0.5 },
  pullBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  ecuTable: { marginTop: 12 },
  ecuRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  ecuLabel: { fontSize: 13, color: '#374151' },
  ecuValue: { fontSize: 13, color: '#1F2937', fontWeight: '700' },
  ecuFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  ecuFooterText: { fontSize: 12, color: '#6B7280' },

  ecuEmpty: {
    alignItems: 'center', paddingVertical: 20,
    backgroundColor: '#F9FAFB', borderRadius: 10, marginTop: 8,
  },
  ecuEmptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },

  // ── Improved WhatsApp send card ────────────────────────────────────────
  whatsappCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 16,
    marginTop: 6,
    borderWidth: 1, borderColor: '#D1FAE5',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  whatsappCardHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginBottom: 16,
  },
  whatsappLogoCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center', alignItems: 'center',
  },
  whatsappCardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  whatsappCardSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 17 },

  whatsappPhoneLabel: {
    fontSize: 12, fontWeight: '600', color: '#374151',
    marginBottom: 6, marginTop: 4,
  },
  whatsappPhoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4,
  },
  whatsappPhonePrefix: {
    fontSize: 16, fontWeight: '600', color: '#6B7280',
  },
  whatsappPhoneInput: {
    flex: 1, fontSize: 15, color: '#1F2937',
    paddingVertical: 10,
  },
  whatsappPhoneHint: {
    fontSize: 11, color: '#9CA3AF',
    marginTop: 6, marginBottom: 14, fontStyle: 'italic',
  },

  whatsappPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: '#25D366',
    paddingVertical: 16, borderRadius: 12,
    shadowColor: '#25D366', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  whatsappPrimaryBtnDisabled: { opacity: 0.6 },
  whatsappPrimaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  // ── Save (records-only) ────────────────────────────────────────────────
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#FFFFFF',
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#8B0000', marginTop: 12,
  },
  secondaryBtnText: { color: '#8B0000', fontWeight: '700', fontSize: 14 },
});
