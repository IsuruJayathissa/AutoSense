import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OBDService from '../services/OBDService';
import AIModelService from '../services/AIModelService';

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
const LABEL_COLOR = {
  Normal:   '#10B981',
  Warning:  '#F59E0B',
  Critical: '#EF4444',
};
const LABEL_ICON = {
  Normal:   'checkmark-circle',
  Warning:  'warning',
  Critical: 'alert-circle',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Probability bar component
// ─────────────────────────────────────────────────────────────────────────────
function ProbBar({ label, pct }) {
  const color = LABEL_COLOR[label];
  return (
    <View style={styles.probRow}>
      <Text style={styles.probLabel}>{label}</Text>
      <View style={styles.probTrack}>
        <View style={[styles.probFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.probPct, { color }]}>{pct}%</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function AIDiagnosticsScreen({ navigation }) {
  // ── Connection ─────────────────────────────────────────────────────────────
  const [obdConnected, setObdConnected] = useState(OBDService.isConnected);

  // ── Training state ─────────────────────────────────────────────────────────
  const [trainingRecords, setTrainingRecords] = useState(null); // null = not loaded yet
  const [isTraining,      setIsTraining]      = useState(false);
  const [trainProgress,   setTrainProgress]   = useState(null); // { epoch, total, loss, acc }
  const [modelTrained,    setModelTrained]    = useState(AIModelService.isTrained);
  const [modelAccuracy,   setModelAccuracy]   = useState(AIModelService.lastAccuracy);

  // ── Live inference state ───────────────────────────────────────────────────
  const [inferring,    setInferring]    = useState(false);
  const [liveSensor,   setLiveSensor]   = useState(null);
  const [prediction,   setPrediction]   = useState(null);
  const inferIntervalRef = useRef(null);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = OBDService.onConnectionChange(connected => {
      setObdConnected(connected);
      if (!connected && inferring) stopInference();
    });

    loadRecordCount();

    return () => {
      unsubscribe();
      stopInference();
    };
  }, []);

  const loadRecordCount = async () => {
    try {
      await AIModelService.ready();
      setModelTrained(AIModelService.isTrained);
      setModelAccuracy(AIModelService.lastAccuracy);
      const records = await AIModelService.fetchTrainingRecords();
      setTrainingRecords(records.length);
    } catch (e) {
      setTrainingRecords(0);
    }
  };

  // ── Train ──────────────────────────────────────────────────────────────────
  const handleTrain = async () => {
    if (isTraining) return;
    setIsTraining(true);
    setTrainProgress(null);
    setPrediction(null);

    try {
      const result = await AIModelService.train((epoch, total, loss, acc) => {
        setTrainProgress({ epoch, total, loss: loss.toFixed(4), acc: Math.round(acc * 100) });
      });

      setModelTrained(true);
      setModelAccuracy(result.accuracy);
      Alert.alert(
        'Training Complete',
        `Model trained on ${result.sessions} sessions.\nAccuracy: ${result.accuracy}%`
      );
    } catch (e) {
      Alert.alert('Training Failed', e.message);
    } finally {
      setIsTraining(false);
      setTrainProgress(null);
    }
  };

  // ── Retrain ────────────────────────────────────────────────────────────────
  const handleRetrain = () => {
    Alert.alert('Retrain Model', 'This will replace the current model. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Retrain', style: 'destructive',
        onPress: async () => {
          await AIModelService.reset();
          setModelTrained(false);
          setModelAccuracy(null);
          setPrediction(null);
          handleTrain();
        },
      },
    ]);
  };

  // ── Live inference ─────────────────────────────────────────────────────────
  const startInference = useCallback(() => {
    if (inferIntervalRef.current) return;
    setInferring(true);

    inferIntervalRef.current = setInterval(async () => {
      const data = await OBDService.getSensorData();
      if (!data) return;
      setLiveSensor(data);
      const result = AIModelService.predict(data);
      if (result) setPrediction(result);
    }, 2000);
  }, []);

  const stopInference = useCallback(() => {
    if (inferIntervalRef.current) {
      clearInterval(inferIntervalRef.current);
      inferIntervalRef.current = null;
    }
    setInferring(false);
  }, []);

  const toggleInference = () => {
    if (inferring) stopInference();
    else startInference();
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safe}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Diagnostics</Text>
          <View style={[styles.connBadge, { backgroundColor: obdConnected ? '#10B981' : '#9CA3AF' }]}>
            <View style={styles.connDot} />
            <Text style={styles.connText}>{obdConnected ? 'OBD' : 'OFF'}</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Overview banner ──────────────────────────────────────────── */}
          <LinearGradient colors={['#8B0000', '#A00000']} style={styles.banner}>
            <Ionicons name="hardware-chip-outline" size={36} color="#FFFFFF" />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.bannerTitle}>On-Device AI Engine</Text>
              <Text style={styles.bannerSub}>
                Neural network trained on your labeled OBD sessions.
                Detects anomalies in real time.
              </Text>
            </View>
          </LinearGradient>

          {/* ── Training data stats ──────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardTopBar} />
            <Text style={styles.cardTitle}>Training Data</Text>

            <View style={styles.statsRow}>
              <StatBox
                icon="server-outline"
                label="Labeled Sessions"
                value={trainingRecords === null ? '—' : trainingRecords}
                color="#8B0000"
              />
              <StatBox
                icon="analytics-outline"
                label="Model Status"
                value={modelTrained ? 'Trained' : 'Untrained'}
                color={modelTrained ? '#10B981' : '#9CA3AF'}
              />
              <StatBox
                icon="ribbon-outline"
                label="Accuracy"
                value={modelAccuracy !== null ? `${modelAccuracy}%` : '—'}
                color="#F59E0B"
              />
            </View>

            {trainingRecords !== null && trainingRecords < 5 && (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle-outline" size={16} color="#F59E0B" />
                <Text style={styles.warningText}>
                  {`Collect at least ${5 - trainingRecords} more labeled session${5 - trainingRecords > 1 ? 's' : ''} to enable training.`}
                </Text>
              </View>
            )}
          </View>

          {/* ── Train / Retrain ──────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardTopBar} />
            <Text style={styles.cardTitle}>Model Training</Text>
            <Text style={styles.cardSub}>
              TensorFlow.js trains a 3-layer neural network on your device using
              RPM, Coolant Temp, Engine Load, Throttle, and Battery Voltage as
              input features. Labels: Normal / Warning / Critical.
            </Text>

            {/* Progress bar during training */}
            {isTraining && trainProgress && (
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    Epoch {trainProgress.epoch} / {trainProgress.total}
                  </Text>
                  <Text style={styles.progressLabel}>
                    Acc {trainProgress.acc}%  Loss {trainProgress.loss}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(trainProgress.epoch / trainProgress.total) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            {isTraining && !trainProgress && (
              <View style={styles.progressBox}>
                <ActivityIndicator color="#8B0000" />
                <Text style={{ color: '#6B7280', marginTop: 8, fontSize: 13 }}>
                  Loading training data…
                </Text>
              </View>
            )}

            <View style={styles.btnRow}>
              {!modelTrained ? (
                <TouchableOpacity
                  style={[styles.trainBtn, (isTraining || (trainingRecords ?? 0) < 5) && styles.btnDisabled]}
                  onPress={handleTrain}
                  disabled={isTraining || (trainingRecords ?? 0) < 5}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#8B0000', '#A00000']} style={styles.trainBtnGrad}>
                    {isTraining
                      ? <ActivityIndicator color="#FFF" />
                      : <Ionicons name="flash" size={18} color="#FFF" />}
                    <Text style={styles.trainBtnText}>
                      {isTraining ? 'Training…' : 'Train Model'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.trainBtn, isTraining && styles.btnDisabled]}
                  onPress={handleRetrain}
                  disabled={isTraining}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#374151', '#1F2937']} style={styles.trainBtnGrad}>
                    <Ionicons name="refresh" size={18} color="#FFF" />
                    <Text style={styles.trainBtnText}>Retrain</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Live Inference ───────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardTopBar} />
            <Text style={styles.cardTitle}>Live Inference</Text>

            {!modelTrained ? (
              <View style={styles.emptyBox}>
                <Ionicons name="hardware-chip-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>Train the model first to enable live inference.</Text>
              </View>
            ) : !obdConnected ? (
              <View style={styles.emptyBox}>
                <Ionicons name="bluetooth-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyText}>Connect OBD device to start live inference.</Text>
                <TouchableOpacity
                  style={styles.connectLink}
                  onPress={() => navigation.navigate('OBDConnection')}
                >
                  <Text style={styles.connectLinkText}>Go to OBD Connection →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Start / Stop */}
                <TouchableOpacity
                  style={styles.inferBtn}
                  onPress={toggleInference}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={inferring ? ['#374151', '#1F2937'] : ['#8B0000', '#A00000']}
                    style={styles.trainBtnGrad}
                  >
                    <Ionicons
                      name={inferring ? 'stop-circle' : 'play-circle'}
                      size={18} color="#FFF"
                    />
                    <Text style={styles.trainBtnText}>
                      {inferring ? 'Stop Inference' : 'Start Live Inference'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Live sensor snapshot */}
                {liveSensor && (
                  <View style={styles.sensorGrid}>
                    <SensorChip label="RPM"        value={`${liveSensor.rpm}`} />
                    <SensorChip label="Coolant"    value={`${liveSensor.coolantTemp}°C`} />
                    <SensorChip label="Load"       value={`${liveSensor.engineLoad}%`} />
                    <SensorChip label="Throttle"   value={`${liveSensor.throttle}%`} />
                    <SensorChip label="Voltage"    value={`${liveSensor.voltage}V`} />
                  </View>
                )}

                {/* Prediction result */}
                {prediction && (
                  <>
                    {/* Anomaly banner */}
                    <View style={[
                      styles.predBanner,
                      { backgroundColor: LABEL_COLOR[prediction.label] + '18',
                        borderColor:      LABEL_COLOR[prediction.label] },
                    ]}>
                      <Ionicons
                        name={LABEL_ICON[prediction.label]}
                        size={28}
                        color={LABEL_COLOR[prediction.label]}
                      />
                      <View style={{ marginLeft: 12 }}>
                        <Text style={[styles.predLabel, { color: LABEL_COLOR[prediction.label] }]}>
                          {prediction.label}
                        </Text>
                        <Text style={styles.predConfidence}>
                          {prediction.confidence}% confidence
                        </Text>
                      </View>
                    </View>

                    {/* Probability bars */}
                    <View style={styles.probSection}>
                      <Text style={styles.probTitle}>Class Probabilities</Text>
                      <ProbBar label="Normal"   pct={prediction.probabilities.Normal} />
                      <ProbBar label="Warning"  pct={prediction.probabilities.Warning} />
                      <ProbBar label="Critical" pct={prediction.probabilities.Critical} />
                    </View>

                    {prediction.label === 'Critical' && (
                      <View style={styles.alertBox}>
                        <Ionicons name="alert-circle" size={18} color="#EF4444" />
                        <Text style={styles.alertText}>
                          Anomaly detected! Inspect your engine immediately.
                        </Text>
                      </View>
                    )}
                  </>
                )}

                {inferring && !prediction && (
                  <View style={styles.waitBox}>
                    <ActivityIndicator color="#8B0000" size="small" />
                    <Text style={styles.waitText}>Waiting for sensor data…</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* ── How it works ─────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardTopBar} />
            <Text style={styles.cardTitle}>How It Works</Text>
            {[
              ['1', 'server-outline',       'Collect labeled OBD sessions',   'Record Normal, Warning, or Critical driving sessions in Data Collection.'],
              ['2', 'flash-outline',         'Train on-device',                'TensorFlow.js trains a neural network locally on your phone — no server needed.'],
              ['3', 'hardware-chip-outline', 'Live inference',                 'The model reads live OBD sensor values every 2 seconds and classifies engine state.'],
              ['4', 'notifications-outline', 'Anomaly alert',                  'If Critical is predicted, you get an immediate warning on screen.'],
            ].map(([num, icon, title, desc]) => (
              <View key={num} style={styles.stepRow}>
                <View style={styles.stepBubble}>
                  <Text style={styles.stepNum}>{num}</Text>
                </View>
                <Ionicons name={icon} size={20} color="#8B0000" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{title}</Text>
                  <Text style={styles.stepDesc}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function StatBox({ icon, label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SensorChip({ label, value }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F9FAFB' },
  safe:        { flex: 1 },
  scroll:      { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  connBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5,
  },
  connDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  connText: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  // Banner
  banner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 18, marginBottom: 14,
  },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  bannerSub:   { fontSize: 12, color: '#FCA5A5', lineHeight: 17 },

  // Cards
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18,
    marginBottom: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, backgroundColor: '#8B0000',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 4 },
  cardSub:   { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 14 },

  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  statBox:  { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#9CA3AF', textAlign: 'center' },

  // Warning
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderRadius: 8,
    padding: 10, marginTop: 14, borderWidth: 1, borderColor: '#FDE68A',
  },
  warningText: { fontSize: 12, color: '#92400E', flex: 1 },

  // Train button
  btnRow:       { marginTop: 8 },
  trainBtn:     { borderRadius: 12, overflow: 'hidden' },
  inferBtn:     { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  trainBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8 },
  trainBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  btnDisabled:  { opacity: 0.5 },

  // Training progress
  progressBox: {
    backgroundColor: '#F9FAFB', borderRadius: 10,
    padding: 14, marginBottom: 14, alignItems: 'center',
  },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginBottom: 8,
  },
  progressLabel: { fontSize: 12, color: '#6B7280' },
  progressTrack: {
    width: '100%', height: 8, backgroundColor: '#E5E7EB',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill:  { height: '100%', backgroundColor: '#8B0000', borderRadius: 4 },

  // Sensor grid
  sensorGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14,
  },
  chip: {
    backgroundColor: '#F3F4F6', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  chipLabel: { fontSize: 10, color: '#9CA3AF' },
  chipValue: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginTop: 2 },

  // Prediction
  predBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1.5,
    padding: 14, marginBottom: 14,
  },
  predLabel:      { fontSize: 20, fontWeight: '800' },
  predConfidence: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Probability bars
  probSection: { marginBottom: 14 },
  probTitle:   { fontSize: 13, fontWeight: '600', color: '#1F2937', marginBottom: 10 },
  probRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  probLabel:   { width: 58, fontSize: 12, color: '#374151', fontWeight: '500' },
  probTrack:   { flex: 1, height: 10, backgroundColor: '#E5E7EB', borderRadius: 5, overflow: 'hidden' },
  probFill:    { height: '100%', borderRadius: 5 },
  probPct:     { width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Alerts
  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  alertText: { fontSize: 13, color: '#B91C1C', flex: 1, fontWeight: '500' },

  // Empty / wait states
  emptyBox:        { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyText:       { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  connectLink:     { marginTop: 4 },
  connectLinkText: { fontSize: 13, color: '#8B0000', fontWeight: '600' },
  waitBox:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  waitText:        { fontSize: 13, color: '#9CA3AF' },

  // How it works steps
  stepRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  stepBubble: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#8B0000', justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  stepNum:   { fontSize: 11, fontWeight: '800', color: '#FFF' },
  stepTitle: { fontSize: 13, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  stepDesc:  { fontSize: 12, color: '#6B7280', lineHeight: 17 },
});
