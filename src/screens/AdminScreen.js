import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../config/firebase';
import { isAdminEmail } from '../config/admin';
import AdminVehicleService from '../services/AdminVehicleService';
import AdminFaultCodeService from '../services/AdminFaultCodeService';

const SEVERITIES = ['Info', 'Warning', 'Critical'];
const TABS = [
  { id: 'vehicles', label: 'Vehicles',    icon: 'car-sport-outline' },
  { id: 'dtcs',     label: 'Fault Codes', icon: 'alert-circle-outline' },
];

export default function AdminScreen({ navigation }) {
  const email = auth.currentUser?.email;
  const allowed = isAdminEmail(email);

  const [tab, setTab] = useState('vehicles');
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [codes, setCodes] = useState([]);

  // Edit/create modal state
  const [editing, setEditing] = useState(null); // { type, item } or null

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        AdminVehicleService.listVehicles(),
        AdminFaultCodeService.listCodes(),
      ]);
      setVehicles(v);
      setCodes(c);
    } catch (e) {
      Alert.alert('Load Failed', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) reload();
  }, [allowed, reload]);

  // ── Gate non-admin users ────────────────────────────────────────────────
  if (!allowed) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safe}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Admin</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.deniedBox}>
            <Ionicons name="lock-closed-outline" size={56} color="#9CA3AF" />
            <Text style={styles.deniedTitle}>Access Denied</Text>
            <Text style={styles.deniedSub}>
              This screen is restricted to AutoSense administrators.
            </Text>
            <Text style={styles.deniedEmail}>Signed in as {email || 'unknown'}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Delete handlers ─────────────────────────────────────────────────────
  const handleDeleteVehicle = (v) => {
    Alert.alert('Delete Vehicle', `Remove "${v.brand} ${v.model}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await AdminVehicleService.deleteVehicle(v.id);
            await reload();
          } catch (e) { Alert.alert('Delete Failed', e.message); }
        },
      },
    ]);
  };

  const handleDeleteCode = (c) => {
    Alert.alert('Delete Code', `Remove fault code "${c.code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await AdminFaultCodeService.deleteCode(c.code);
            await reload();
          } catch (e) { Alert.alert('Delete Failed', e.message); }
        },
      },
    ]);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Admin</Text>
          <View style={styles.adminBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(t.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={t.icon} size={16} color={active ? '#8B0000' : '#6B7280'} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Add new button */}
        <View style={styles.toolbar}>
          <Text style={styles.countText}>
            {tab === 'vehicles'
              ? `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`
              : `${codes.length} fault code${codes.length === 1 ? '' : 's'}`}
          </Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setEditing({ type: tab, item: null })}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add New</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#8B0000" />
          </View>
        ) : tab === 'vehicles' ? (
          <FlatList
            data={vehicles}
            keyExtractor={(v) => v.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="car-sport-outline"
                title="No vehicles yet"
                subtitle="Add the first vehicle to the catalog."
              />
            }
            renderItem={({ item: v }) => (
              <VehicleRow
                v={v}
                onEdit={() => setEditing({ type: 'vehicles', item: v })}
                onDelete={() => handleDeleteVehicle(v)}
              />
            )}
          />
        ) : (
          <FlatList
            data={codes}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState
                icon="alert-circle-outline"
                title="No admin-managed codes"
                subtitle="Add 1KD-specific codes like P1601, P2002, P0093."
              />
            }
            renderItem={({ item: c }) => (
              <CodeRow
                c={c}
                onEdit={() => setEditing({ type: 'dtcs', item: c })}
                onDelete={() => handleDeleteCode(c)}
              />
            )}
          />
        )}

        {/* Edit / Create modal */}
        <EditModal
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reload(); }}
        />
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row components
// ─────────────────────────────────────────────────────────────────────────────
function VehicleRow({ v, onEdit, onDelete }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconCircle}>
        <Ionicons name="car-sport" size={20} color="#8B0000" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{v.brand} {v.model}</Text>
        <Text style={styles.rowSub}>
          {[v.year, v.engineType].filter(Boolean).join(' • ') || 'No year / engine'}
        </Text>
        <Text style={styles.rowId}>id: {v.id}</Text>
      </View>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

function CodeRow({ c, onEdit, onDelete }) {
  const sevColor = c.severity === 'Critical' ? '#DC2626' : c.severity === 'Warning' ? '#F59E0B' : '#10B981';
  return (
    <View style={styles.row}>
      <View style={[styles.rowCodeBadge, { backgroundColor: sevColor }]}>
        <Text style={styles.rowCodeText}>{c.code}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{c.description}</Text>
        <Text style={styles.rowSub}>
          {c.severity || 'Warning'} • {c.brand || 'Generic'}
        </Text>
      </View>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <View style={styles.rowActions}>
      <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
        <Ionicons name="create-outline" size={18} color="#1F2937" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={styles.iconBtn}>
        <Ionicons name="trash-outline" size={18} color="#DC2626" />
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={48} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subtitle}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit modal — single form for both Vehicles and DTCs
// ─────────────────────────────────────────────────────────────────────────────
function EditModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    if (editing.type === 'vehicles') {
      const v = editing.item || {};
      setForm({
        id: v.id || null,
        brand: v.brand || '',
        model: v.model || '',
        year: v.year || '',
        engineType: v.engineType || '',
        vehicleNumber: v.vehicleNumber || '',
      });
    } else {
      const c = editing.item || {};
      setForm({
        code:        c.code || '',
        description: c.description || '',
        severity:    c.severity || 'Warning',
        cause:       c.cause || '',
        fix:         c.fix || '',
        brand:       c.brand || 'Generic OBD-II',
      });
    }
  }, [editing]);

  if (!editing) return null;
  const isVehicle = editing.type === 'vehicles';
  const isNew = !editing.item;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isVehicle) {
        await AdminVehicleService.upsertVehicle(form);
      } else {
        await AdminFaultCodeService.upsertCode(form);
      }
      await onSaved();
    } catch (e) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isNew ? `Add ${isVehicle ? 'Vehicle' : 'Fault Code'}` : `Edit ${isVehicle ? 'Vehicle' : 'Fault Code'}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {isVehicle ? (
            <>
              <Field label="Brand *" value={form.brand} onChangeText={(v) => setForm({ ...form, brand: v })} placeholder="e.g. Toyota" />
              <Field label="Model *" value={form.model} onChangeText={(v) => setForm({ ...form, model: v })} placeholder="e.g. Hiace" />
              <Field label="Year"   value={form.year}  onChangeText={(v) => setForm({ ...form, year: v })}  placeholder="e.g. 2008" keyboardType="numeric" />
              <Field label="Engine Type" value={form.engineType} onChangeText={(v) => setForm({ ...form, engineType: v })} placeholder="e.g. 1KD-FTV Diesel" />
              <Field label="Default Vehicle Number" value={form.vehicleNumber} onChangeText={(v) => setForm({ ...form, vehicleNumber: v })} placeholder="(optional)" />
            </>
          ) : (
            <>
              <Field
                label="Code *"
                value={form.code}
                onChangeText={(v) => setForm({ ...form, code: v.toUpperCase() })}
                placeholder="e.g. P1601"
                autoCapitalize="characters"
                editable={isNew}
              />
              <Field
                label="Description *"
                value={form.description}
                onChangeText={(v) => setForm({ ...form, description: v })}
                placeholder="e.g. Glow plug control circuit malfunction"
                multiline
              />
              <Text style={styles.fieldLabel}>Severity</Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map(s => {
                  const active = form.severity === s;
                  const color = s === 'Critical' ? '#DC2626' : s === 'Warning' ? '#F59E0B' : '#10B981';
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.severityBtn, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setForm({ ...form, severity: s })}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.severityText, active ? { color: '#FFFFFF' } : { color }]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Field
                label="Cause"
                value={form.cause}
                onChangeText={(v) => setForm({ ...form, cause: v })}
                placeholder="What likely causes this DTC"
                multiline
              />
              <Field
                label="Fix"
                value={form.fix}
                onChangeText={(v) => setForm({ ...form, fix: v })}
                placeholder="Recommended fix"
                multiline
              />
              <Field
                label="Brand"
                value={form.brand}
                onChangeText={(v) => setForm({ ...form, brand: v })}
                placeholder="Toyota / Generic OBD-II / etc."
              />
            </>
          )}

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8B0000', '#A00000']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtnGrad}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {isNew ? 'Create' : 'Save Changes'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, ...props }) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, props.multiline && styles.fieldInputMultiline]}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safe: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#8B0000', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  adminBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#8B0000' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#8B0000' },

  // Toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  countText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B0000', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  // List
  listContent: { padding: 12 },
  loadingBox: { padding: 40, alignItems: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  rowIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center', alignItems: 'center',
  },
  rowCodeBadge: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, minWidth: 60, alignItems: 'center',
  },
  rowCodeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },

  rowTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  rowSub:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowId:    { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 4 },
  iconBtn:    { padding: 8 },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  // Denied
  deniedBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  deniedTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 16 },
  deniedSub: { fontSize: 13, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  deniedEmail: { fontSize: 11, color: '#9CA3AF', marginTop: 16 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  modalBody: { padding: 16 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1F2937',
  },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF',
  },
  severityText: { fontSize: 13, fontWeight: '700' },

  saveBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 24 },
  saveBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
