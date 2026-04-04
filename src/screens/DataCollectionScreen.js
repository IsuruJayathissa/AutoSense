import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, StatusBar, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, collection, addDoc, getDocs,
         deleteDoc, updateDoc, query, where,
         serverTimestamp } from 'firebase/firestore';
import { Share } from 'react-native';
import { auth, db } from '../config/firebase';
import OBDService from '../services/OBDService';
import DataCollectorService from '../services/DataCollectorService';

const TABS = [
  { key: 'record',   label: 'Record',   icon: 'radio-button-on' },
  { key: 'sessions', label: 'Sessions', icon: 'list' },
];

const LABELS = [
  { value: 'Normal',   icon: 'checkmark-circle', color: '#10B981', bg: '#ECFDF5', border: '#10B981', desc: 'Engine running normally' },
  { value: 'Warning',  icon: 'warning',           color: '#F59E0B', bg: '#FFFBEB', border: '#F59E0B', desc: 'Minor issues detected' },
  { value: 'Critical', icon: 'alert-circle',      color: '#EF4444', bg: '#FEF2F2', border: '#EF4444', desc: 'Serious fault detected' },
];

const getLabelMeta = (value) => LABELS.find(l => l.value === value) || LABELS[0];

export default function DataCollectionScreen({ navigation }) {
  const [activeTab, setActiveTab]             = useState('record');
  const [isRecording, setIsRecording]         = useState(false);
  const [snapshotCount, setSnapshotCount]     = useState(0);
  const [selectedLabel, setSelectedLabel]     = useState(null);
  const [saving, setSaving]                   = useState(false);
  const [elapsed, setElapsed]                 = useState(0);
  const [vehicleBrand, setVehicleBrand]       = useState('Unknown');
  const [liveData, setLiveData]               = useState(null);
  const [sessions, setSessions]               = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingSession, setEditingSession]   = useState(null);
  const [editLabel, setEditLabel]             = useState('');
  const [deletingId, setDeletingId]           = useState(null);
  const [exporting, setExporting]             = useState(false);
  const pollingRef = useRef(null);
  const timerRef   = useRef(null);

  const [obdConnected, setObdConnected] = useState(OBDService.isConnected);

  useEffect(() => { loadVehicleBrand(); }, []);
  useEffect(() => { if (activeTab === 'sessions') fetchSessions(); }, [activeTab]);
  useEffect(() => () => stopAllIntervals(), []);
  useEffect(() => {
    const unsubscribe = OBDService.onConnectionChange(setObdConnected);
    return unsubscribe;
  }, []);

  const stopAllIntervals = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current)   clearInterval(timerRef.current);
  };

  const loadVehicleBrand = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const uv = await getDoc(doc(db, 'userVehicles', userId));
      if (uv.exists()) {
        const vDoc = await getDoc(doc(db, 'vehicles', uv.data().vehicleId));
        if (vDoc.exists()) setVehicleBrand(vDoc.data().brand || 'Unknown');
      }
    } catch (e) { console.warn(e); }
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const snap = await getDocs(query(collection(db, 'trainingData'), where('userId', '==', userId)));
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setSessions(rows);
    } catch (e) {
      Alert.alert('Error', 'Failed to load sessions: ' + e.message);
    } finally { setLoadingSessions(false); }
  };

  const handleStartRecording = () => {
    if (!OBDService.isConnected) {
      Alert.alert('Not Connected', 'Please connect to an OBD device to record sensor data.');
      return;
    }
    DataCollectorService.startSession();
    setIsRecording(true); setSnapshotCount(0); setElapsed(0); setSelectedLabel(null); setLiveData(null);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    pollingRef.current = setInterval(async () => {
      const data = await OBDService.getSensorData();
      if (data) { DataCollectorService.recordSnapshot(data); setLiveData(data); setSnapshotCount(DataCollectorService.getSnapshotCount()); }
    }, 5000);
  };

  const handleStopRecording = () => {
    stopAllIntervals();
    const count = DataCollectorService.stopSession();
    setIsRecording(false);
    if (count < 2) {
      Alert.alert('Too Short', 'Need at least 2 snapshots (10 seconds).',
        [{ text: 'OK', onPress: () => DataCollectorService.discardSession() }]);
      setSnapshotCount(0);
    }
  };

  const handleSave = async () => {
    if (!selectedLabel) { Alert.alert('Select a Label', 'Choose Normal, Warning or Critical first.'); return; }
    if (snapshotCount < 2) { Alert.alert('No Data', 'Record a session first.'); return; }
    setSaving(true);
    try {
      await DataCollectorService.saveLabeledSession(selectedLabel, vehicleBrand);
      setSnapshotCount(0); setSelectedLabel(null); setElapsed(0); setLiveData(null);
      Alert.alert('Saved!', 'Session saved with label: ' + selectedLabel);
    } catch (e) { Alert.alert('Save Failed', e.message); }
    finally { setSaving(false); }
  };

  const handleDiscard = () => {
    Alert.alert('Discard Session', 'Discard this recorded session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => {
        DataCollectorService.discardSession();
        setSnapshotCount(0); setSelectedLabel(null); setElapsed(0); setLiveData(null);
      }},
    ]);
  };

  const openEditModal = (session) => { setEditingSession(session); setEditLabel(session.label); setEditModalVisible(true); };

  const handleUpdateLabel = async () => {
    if (!editingSession || !editLabel) return;
    try {
      await updateDoc(doc(db, 'trainingData', editingSession.id), { label: editLabel });
      setSessions(prev => prev.map(s => s.id === editingSession.id ? { ...s, label: editLabel } : s));
      setEditModalVisible(false); setEditingSession(null);
      Alert.alert('Updated!', 'Label changed to: ' + editLabel);
    } catch (e) { Alert.alert('Update Failed', e.message); }
  };

  const handleDelete = (session) => {
    Alert.alert('Delete Session', `Delete session labelled "${session.label}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeletingId(session.id);
        try {
          await deleteDoc(doc(db, 'trainingData', session.id));
          setSessions(prev => prev.filter(s => s.id !== session.id));
        } catch (e) { Alert.alert('Delete Failed', e.message); }
        finally { setDeletingId(null); }
      }},
    ]);
  };

  const handleExportCSV = async () => {
    if (sessions.length === 0) { Alert.alert('No Data', 'No sessions to export yet.'); return; }
    setExporting(true);
    try {
      const headers = ['sessionId','label','vehicleBrand','snapshotCount','avg_rpm','avg_speed','avg_coolantTemp','avg_throttle','avg_fuelLevel','avg_engineLoad','avg_voltage','max_rpm','max_coolantTemp','min_voltage','createdAt'];
      const rows = sessions.map(s => [
        s.sessionId??'', s.label??'', s.vehicleBrand??'', s.snapshotCount??'',
        s.avg_rpm??'', s.avg_speed??'', s.avg_coolantTemp??'', s.avg_throttle??'',
        s.avg_fuelLevel??'', s.avg_engineLoad??'', s.avg_voltage??'',
        s.max_rpm??'', s.max_coolantTemp??'', s.min_voltage??'', formatDate(s.createdAt),
      ].join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      await Share.share({ message: csv, title: 'AutoSense Training Data CSV' });
    } catch (e) { Alert.alert('Export Failed', e.message); }
    finally { setExporting(false); }
  };

  const formatTime = (secs) => `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const labelCounts = LABELS.reduce((acc, l) => { acc[l.value] = sessions.filter(s => s.label === l.value).length; return acc; }, {});

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Data Collection</Text>
          <View style={[styles.headerBadge, { backgroundColor: obdConnected ? '#10B981' : '#F59E0B' }]}>
            <Text style={styles.headerBadgeText}>{obdConnected ? 'LIVE' : 'SIM'}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
              <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#FFFFFF' : '#6B7280'} />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              {tab.key === 'sessions' && sessions.length > 0 && (
                <View style={styles.tabCountBadge}><Text style={styles.tabCountText}>{sessions.length}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'record' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color="#8B0000" />
              <Text style={styles.infoText}>Record driving sessions and label them to train the engine health AI model.</Text>
            </View>

            <View style={styles.sessionCard}>
              <View style={styles.sessionCardBorder} />
              <View style={styles.sessionRow}>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatValue}>{snapshotCount}</Text>
                  <Text style={styles.sessionStatLabel}>Snapshots</Text>
                </View>
                <View style={styles.sessionDivider} />
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatValue}>{formatTime(elapsed)}</Text>
                  <Text style={styles.sessionStatLabel}>Duration</Text>
                </View>
                <View style={styles.sessionDivider} />
                <View style={styles.sessionStat}>
                  <View style={[styles.recordingDot, { backgroundColor: isRecording ? '#EF4444' : '#D1D5DB' }]} />
                  <Text style={styles.sessionStatLabel}>{isRecording ? 'Recording' : 'Stopped'}</Text>
                </View>
              </View>
            </View>

            {liveData && (
              <View style={styles.liveCard}>
                <Text style={styles.liveCardTitle}>Latest Snapshot</Text>
                <View style={styles.liveGrid}>
                  {[
                    { label: 'RPM', value: liveData.rpm, unit: '' },
                    { label: 'Speed', value: liveData.speed, unit: ' km/h' },
                    { label: 'Coolant', value: liveData.coolantTemp, unit: '°C' },
                    { label: 'Load', value: liveData.engineLoad, unit: '%' },
                    { label: 'Fuel', value: liveData.fuelLevel, unit: '%' },
                    { label: 'Volts', value: liveData.voltage, unit: 'V' },
                  ].map((item, i) => (
                    <View key={i} style={styles.liveItem}>
                      <Text style={styles.liveValue}>{item.value}{item.unit}</Text>
                      <Text style={styles.liveLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.recordButton}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              disabled={saving} activeOpacity={0.8}>
              <LinearGradient colors={isRecording ? ['#EF4444','#DC2626'] : ['#8B0000','#A00000']}
                start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={styles.recordGradient}>
                <Ionicons name={isRecording ? 'stop-circle' : 'radio-button-on'} size={24} color="#FFFFFF" />
                <Text style={styles.recordButtonText}>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {!isRecording && snapshotCount >= 2 && (
              <>
                <Text style={styles.sectionTitle}>Label This Session</Text>
                <Text style={styles.sectionSubtitle}>What was the engine condition during recording?</Text>
                {LABELS.map(lbl => (
                  <TouchableOpacity key={lbl.value}
                    style={[styles.labelCard, selectedLabel === lbl.value && { borderColor: lbl.border, backgroundColor: lbl.bg }]}
                    onPress={() => setSelectedLabel(lbl.value)} activeOpacity={0.8}>
                    <Ionicons name={lbl.icon} size={28} color={lbl.color} />
                    <View style={styles.labelInfo}>
                      <Text style={[styles.labelName, { color: lbl.color }]}>{lbl.value}</Text>
                      <Text style={styles.labelDesc}>{lbl.desc}</Text>
                    </View>
                    {selectedLabel === lbl.value && <Ionicons name="checkmark-circle" size={22} color={lbl.color} />}
                  </TouchableOpacity>
                ))}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} disabled={saving}>
                    <Ionicons name="trash-outline" size={18} color="#8B0000" />
                    <Text style={styles.discardText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, !selectedLabel && styles.saveButtonDisabled]}
                    onPress={handleSave} disabled={saving || !selectedLabel} activeOpacity={0.8}>
                    <LinearGradient colors={selectedLabel ? ['#8B0000','#A00000'] : ['#D1D5DB','#D1D5DB']} style={styles.saveGradient}>
                      {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> :
                        <><Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" /><Text style={styles.saveText}>Save to Training Data</Text></>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.howCard}>
              <View style={styles.howCardBorder} />
              <Text style={styles.howTitle}>How this helps the AI model</Text>
              {['Record a session while driving','App snapshots 7 sensor values every 5 seconds',
                'Label the session based on engine condition','Labeled data uploads to Firestore training collection',
                'Data is used to train the TensorFlow Lite model'].map((text, i) => (
                <View key={i} style={styles.howRow}>
                  <View style={styles.howStep}><Text style={styles.howStepText}>{i+1}</Text></View>
                  <Text style={styles.howText}>{text}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 30 }} />
          </ScrollView>
        )}

        {activeTab === 'sessions' && (
          <View style={styles.sessionsContainer}>
            <View style={styles.summaryBar}>
              <View style={styles.summaryLeft}>
                {LABELS.map(l => (
                  <View key={l.value} style={[styles.countChip, { backgroundColor: l.bg, borderColor: l.border }]}>
                    <View style={[styles.countDot, { backgroundColor: l.color }]} />
                    <Text style={[styles.countText, { color: l.color }]}>{l.value}: {labelCounts[l.value]}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.toolbar}>
              <TouchableOpacity style={styles.toolbarBtn} onPress={fetchSessions} disabled={loadingSessions}>
                <Ionicons name="refresh" size={18} color="#8B0000" />
                <Text style={styles.toolbarBtnText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolbarBtn, styles.toolbarBtnPrimary]}
                onPress={handleExportCSV} disabled={exporting || sessions.length === 0} activeOpacity={0.8}>
                {exporting ? <ActivityIndicator color="#FFFFFF" size="small" /> :
                  <><Ionicons name="download-outline" size={18} color="#FFFFFF" />
                    <Text style={[styles.toolbarBtnText, { color: '#FFFFFF' }]}>Export CSV ({sessions.length})</Text></>}
              </TouchableOpacity>
            </View>

            {loadingSessions ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color="#8B0000" />
                <Text style={styles.centerText}>Loading sessions...</Text>
              </View>
            ) : sessions.length === 0 ? (
              <View style={styles.centerBox}>
                <Ionicons name="server-outline" size={56} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No sessions yet</Text>
                <Text style={styles.emptySubtext}>Go to the Record tab and save your first session.</Text>
              </View>
            ) : (
              <FlatList data={sessions} keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const meta = getLabelMeta(item.label);
                  const isDeleting = deletingId === item.id;
                  return (
                    <View style={[styles.sessionItem, { borderLeftColor: meta.color }]}>
                      <View style={styles.sessionItemHeader}>
                        <View style={[styles.labelBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                          <Ionicons name={meta.icon} size={14} color={meta.color} />
                          <Text style={[styles.labelBadgeText, { color: meta.color }]}>{item.label}</Text>
                        </View>
                        <Text style={styles.sessionDate}>{formatDate(item.createdAt)}</Text>
                      </View>
                      <View style={styles.sessionItemStats}>
                        {[{ label:'Snapshots', value: item.snapshotCount },
                          { label:'Avg RPM',   value: item.avg_rpm },
                          { label:'Avg Temp',  value: item.avg_coolantTemp ? item.avg_coolantTemp+'°C' : 'N/A' },
                          { label:'Brand',     value: item.vehicleBrand }].map((s, i) => (
                          <View key={i} style={styles.sessionItemStat}>
                            <Text style={styles.sessionItemStatValue}>{s.value ?? 'N/A'}</Text>
                            <Text style={styles.sessionItemStatLabel}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.sessionItemActions}>
                        <TouchableOpacity style={styles.sessionActionBtn} onPress={() => openEditModal(item)} disabled={isDeleting}>
                          <Ionicons name="create-outline" size={16} color="#8B0000" />
                          <Text style={styles.sessionActionText}>Edit Label</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.sessionActionBtn, styles.sessionActionDanger]} onPress={() => handleDelete(item)} disabled={isDeleting}>
                          {isDeleting ? <ActivityIndicator size="small" color="#EF4444" /> :
                            <><Ionicons name="trash-outline" size={16} color="#EF4444" />
                              <Text style={[styles.sessionActionText, { color: '#EF4444' }]}>Delete</Text></>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}
      </SafeAreaView>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Session Label</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#8B0000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Recorded: {editingSession ? formatDate(editingSession.createdAt) : ''}</Text>
            <View style={styles.modalBody}>
              {LABELS.map(lbl => (
                <TouchableOpacity key={lbl.value}
                  style={[styles.modalLabelOption, editLabel === lbl.value && { borderColor: lbl.border, backgroundColor: lbl.bg }]}
                  onPress={() => setEditLabel(lbl.value)} activeOpacity={0.8}>
                  <Ionicons name={lbl.icon} size={24} color={lbl.color} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.modalLabelName, { color: lbl.color }]}>{lbl.value}</Text>
                    <Text style={styles.modalLabelDesc}>{lbl.desc}</Text>
                  </View>
                  {editLabel === lbl.value && <Ionicons name="checkmark-circle" size={22} color={lbl.color} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.modalSaveBtn, !editLabel && { opacity: 0.5 }]}
                onPress={handleUpdateLabel} disabled={!editLabel} activeOpacity={0.8}>
                <LinearGradient colors={['#8B0000','#A00000']} style={styles.modalSaveGradient}>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.modalSaveText}>Update Label</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  headerBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  tabRow: { flexDirection: 'row', padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB' },
  tabBtnActive: { backgroundColor: '#8B0000', borderColor: '#8B0000' },
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#FFFFFF' },
  tabCountBadge: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 2 },
  tabCountText: { fontSize: 11, fontWeight: '700', color: '#8B0000' },
  scrollContent: { padding: 20 },
  infoBanner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#8B0000', marginBottom: 20 },
  infoText: { flex: 1, fontSize: 13, color: '#8B0000', lineHeight: 20 },
  sessionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16, position: 'relative', overflow: 'hidden' },
  sessionCardBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#8B0000' },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  sessionStat: { alignItems: 'center', gap: 6 },
  sessionStatValue: { fontSize: 28, fontWeight: '800', color: '#1F2937' },
  sessionStatLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  sessionDivider: { width: 1, height: 40, backgroundColor: '#E5E7EB' },
  recordingDot: { width: 14, height: 14, borderRadius: 7 },
  liveCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  liveCardTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 12 },
  liveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liveItem: { width: '30%', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  liveValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  liveLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  recordButton: { borderRadius: 14, overflow: 'hidden', marginBottom: 24 },
  recordGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  recordButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  labelCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#E5E7EB' },
  labelInfo: { flex: 1 },
  labelName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  labelDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 24 },
  discardButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: '#8B0000', backgroundColor: '#FFFFFF' },
  discardText: { fontSize: 14, fontWeight: '600', color: '#8B0000' },
  saveButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  saveButtonDisabled: { opacity: 0.5 },
  saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  saveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  howCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden' },
  howCardBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#8B0000' },
  howTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 14 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  howStep: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#8B0000', justifyContent: 'center', alignItems: 'center' },
  howStepText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  howText: { flex: 1, fontSize: 14, color: '#4B5563', lineHeight: 20 },
  sessionsContainer: { flex: 1 },
  summaryBar: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  summaryLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  countDot: { width: 7, height: 7, borderRadius: 4 },
  countText: { fontSize: 12, fontWeight: '600' },
  toolbar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#8B0000', backgroundColor: '#FFFFFF' },
  toolbarBtnPrimary: { backgroundColor: '#8B0000', borderColor: '#8B0000', flex: 1, justifyContent: 'center' },
  toolbarBtnText: { fontSize: 13, fontWeight: '600', color: '#8B0000' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  centerText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  sessionItem: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sessionItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  labelBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  labelBadgeText: { fontSize: 12, fontWeight: '700' },
  sessionDate: { fontSize: 12, color: '#9CA3AF' },
  sessionItemStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  sessionItemStat: { alignItems: 'center', flex: 1 },
  sessionItemStatValue: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
  sessionItemStatLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  sessionItemActions: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sessionActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#8B0000', backgroundColor: '#FEF2F2' },
  sessionActionDanger: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  sessionActionText: { fontSize: 13, fontWeight: '600', color: '#8B0000' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 30, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', paddingHorizontal: 20, paddingTop: 12 },
  modalBody: { padding: 20 },
  modalLabelOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', marginBottom: 10, backgroundColor: '#FFFFFF' },
  modalLabelName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  modalLabelDesc: { fontSize: 13, color: '#6B7280' },
  modalSaveBtn: { marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  modalSaveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  modalSaveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
