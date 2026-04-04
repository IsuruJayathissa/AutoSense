import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OBDService from '../services/OBDService';

// ─────────────────────────────────────────────────────────────────────────────
//  THRESHOLD DEFINITIONS (based on PDF Section 3.3.4)
// ─────────────────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  rpm:         { min: 700,  max: 4000, critical: 5500 },
  coolantTemp: { min: 70,   max: 95,   critical: 105  },
  battery:     { min: 12.0, max: 14.5, critical: 11.5 },
  engineLoad:  { min: 0,    max: 70,   critical: 85   },
  intakeTemp:  { min: 15,   max: 45,   critical: 55   },
  maf:         { min: 1.0,  max: 25,   critical: 0    },
  o2Voltage:   { min: 0.1,  max: 0.9,  healthy: 0.45  },
  // MAF/RPM healthy gradient range (from PDF Section 3.3.4.2)
  mafRpmRatio: { min: 0.003, max: 0.015 },
};

// Sensor parameter ranges for status badges
const PARAM_RANGES = {
  rpm:        { min: 700,  max: 4000, warning: 4500, critical: 5500 },
  coolantTemp:{ min: 70,   max: 95,   warning: 100,  critical: 105  },
  battery:    { min: 12.0, max: 14.5, warning: 12.0, critical: 11.5 },
  engineLoad: { min: 0,    max: 70,   warning: 80,   critical: 85   },
  intakeTemp: { min: 15,   max: 45,   warning: 50,   critical: 55   },
  maf:        { min: 1.0,  max: 25,   warning: 0.5,  critical: 0    },
  throttle:   { min: 0,    max: 80,   warning: 90,   critical: 95   },
  speed:      { min: 0,    max: 120,  warning: 140,  critical: 160  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  HEALTH SCORE CALCULATOR (PDF-based multi-factor approach)
// ─────────────────────────────────────────────────────────────────────────────
const calculateHealthScore = (sessionReadings) => {
  if (!sessionReadings || sessionReadings.length === 0) return 100;

  // Use last 10 readings for a session-based score (not single snapshot)
  const recent = sessionReadings.slice(-10);

  const avg = (key) => {
    const vals = recent.map(r => r[key]).filter(v => v != null && !isNaN(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const max = (key) => {
    const vals = recent.map(r => r[key]).filter(v => v != null && !isNaN(v));
    return vals.length ? Math.max(...vals) : null;
  };

  let score = 100;
  const issues = [];

  // 1. Coolant temperature (PDF Section 3.3.4.4 — Engine Coolant Temperature Monitoring)
  const avgCoolant = avg('coolantTemp');
  const maxCoolant = max('coolantTemp');
  if (maxCoolant !== null) {
    if (maxCoolant > 105) { score -= 25; issues.push({ type: 'critical', msg: 'Coolant temperature critically high (>' + maxCoolant + '°C). Check cooling system immediately.' }); }
    else if (maxCoolant > 100) { score -= 15; issues.push({ type: 'warning', msg: 'Coolant temperature high (' + maxCoolant + '°C). Monitor cooling system.' }); }
    else if (maxCoolant > 95)  { score -= 5;  issues.push({ type: 'info',    msg: 'Coolant temperature approaching threshold (' + maxCoolant + '°C).' }); }
  }

  // 2. Battery voltage (Section 3.3.4 — Electrical monitoring)
  const avgBattery = avg('battery') || avg('voltage');
  if (avgBattery !== null) {
    if (avgBattery < 11.5) { score -= 20; issues.push({ type: 'critical', msg: 'Battery voltage critically low (' + avgBattery.toFixed(1) + 'V). Alternator or battery failure suspected.' }); }
    else if (avgBattery < 12.0) { score -= 10; issues.push({ type: 'warning', msg: 'Battery voltage low (' + avgBattery.toFixed(1) + 'V). Check alternator.' }); }
  }

  // 3. Engine load (PDF Section 3.3.4 — vehicle condition)
  const avgLoad = avg('engineLoad');
  const maxLoad = max('engineLoad');
  if (maxLoad !== null) {
    if (maxLoad > 85) { score -= 10; issues.push({ type: 'warning', msg: 'High engine load detected (' + maxLoad + '%). Sustained high load causes wear.' }); }
  }

  // 4. MAF sensor health via RPM/MAF gradient (PDF Section 3.3.4.2 — MAF Sensor Failure)
  //    Healthy MAF has linear relationship with RPM: MAF/RPM ratio ~ 0.003–0.015
  const mafRpmPairs = recent.filter(r => r.rpm > 1000 && r.maf > 0);
  if (mafRpmPairs.length >= 3) {
    const ratios = mafRpmPairs.map(r => r.maf / r.rpm);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (avgRatio < THRESHOLDS.mafRpmRatio.min) {
      score -= 15;
      issues.push({ type: 'critical', msg: 'MAF/RPM ratio abnormally low (' + avgRatio.toFixed(4) + '). Possible dirty or failing MAF sensor.' });
    } else if (avgRatio > THRESHOLDS.mafRpmRatio.max) {
      score -= 5;
      issues.push({ type: 'warning', msg: 'MAF airflow reading higher than expected. Check air intake.' });
    }
  }

  // 5. O2 sensor health (PDF Section 3.3.4.1 — Oxygen sensor failure detection)
  //    Healthy O2 voltage: 0.1V–0.9V range, centred around 0.45V
  const o2Vals = recent.map(r => r.o2Bank1Sensor1).filter(v => v != null && !isNaN(v));
  if (o2Vals.length >= 3) {
    const o2Min = Math.min(...o2Vals);
    const o2Max = Math.max(...o2Vals);
    const o2Range = o2Max - o2Min;
    // Healthy sensor swings 0.1V→0.9V (range ~0.8V). Failing sensor range narrows
    if (o2Range < 0.2) {
      score -= 15;
      issues.push({ type: 'critical', msg: 'O2 sensor voltage range very narrow (' + o2Range.toFixed(2) + 'V). Sensor may be failing (see PDF Section 3.3.4.1).' });
    } else if (o2Range < 0.4) {
      score -= 8;
      issues.push({ type: 'warning', msg: 'O2 sensor voltage range below normal (' + o2Range.toFixed(2) + 'V). Monitor sensor health.' });
    }
    // Check if stuck lean (all low) or stuck rich (all high)
    const avgO2 = o2Vals.reduce((a, b) => a + b, 0) / o2Vals.length;
    if (avgO2 < 0.2) {
      score -= 10;
      issues.push({ type: 'warning', msg: 'O2 sensor reading consistently lean (avg ' + avgO2.toFixed(2) + 'V). Air/fuel ratio may be too lean.' });
    } else if (avgO2 > 0.8) {
      score -= 10;
      issues.push({ type: 'warning', msg: 'O2 sensor reading consistently rich (avg ' + avgO2.toFixed(2) + 'V). Possible fuel system issue.' });
    }
  }

  // 6. Load + Temperature correlation (PDF Section 3.1.2 — combined risk)
  //    High load + high temp together = overheating risk
  if (avgLoad !== null && avgCoolant !== null && avgLoad > 65 && avgCoolant > 90) {
    score -= 10;
    issues.push({ type: 'warning', msg: 'High engine load (' + avgLoad.toFixed(0) + '%) combined with elevated temperature (' + avgCoolant.toFixed(0) + '°C). Overheating risk — reduce load.' });
  }

  // 7. RPM stability (sudden spikes)
  const rpmVals = recent.map(r => r.rpm).filter(v => v != null);
  if (rpmVals.length >= 3) {
    const maxRpm = Math.max(...rpmVals);
    if (maxRpm > 5000) { score -= 10; issues.push({ type: 'warning', msg: 'RPM spike detected (' + maxRpm + ' RPM). Avoid sustained high RPM.' }); }
    else if (maxRpm > 4500) { score -= 5; issues.push({ type: 'info', msg: 'High RPM observed (' + maxRpm + ' RPM). Monitor engine strain.' }); }
  }

  return {
    score: Math.max(Math.round(score), 0),
    issues,
    sampleCount: recent.length,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  PARAMETER STATUS (improved ranges)
// ─────────────────────────────────────────────────────────────────────────────
const getParamStatus = (param, value) => {
  const r = PARAM_RANGES[param];
  if (!r) return { status: 'Normal', color: '#10B981' };
  const v = parseFloat(value);
  if (isNaN(v)) return { status: 'N/A', color: '#9CA3AF' };
  if (v >= r.critical && r.critical > 0 && v >= r.critical) return { status: 'Critical', color: '#EF4444' };
  if (v > r.warning || (r.warning < r.min && v < r.warning)) return { status: 'Warning', color: '#F59E0B' };
  if (v < r.min || v > r.max) return { status: 'Warning', color: '#F59E0B' };
  return { status: 'Normal', color: '#10B981' };
};

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function EngineHealthScreen({ navigation }) {
  const [parameters, setParameters] = useState(null);
  const [healthResult, setHealthResult] = useState({ score: 100, issues: [], sampleCount: 0 });
  const [sessionReadings, setSessionReadings] = useState([]);
  const [isConnected, setIsConnected] = useState(OBDService.isConnected);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  // ── Polling ──────────────────────────────────────────────────────────────
  const startPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const data = await OBDService.getSensorData();
        if (!data) return;

        // Also try to get O2 sensor from extended data
        let extData = null;
        try { extData = await OBDService.getExtendedSensorData(); } catch (_) {}

        const snapshot = {
          rpm:             data.rpm,
          coolantTemp:     data.coolantTemp,
          battery:         data.voltage,
          engineLoad:      data.engineLoad,
          throttle:        data.throttle,
          speed:           data.speed,
          intakeTemp:      data.intakeTemp,
          maf:             data.maf,
          o2Bank1Sensor1:  extData?.o2Bank1Sensor1 ?? null,
          timestamp:       Date.now(),
        };

        setParameters(snapshot);
        setLastUpdated(new Date());

        // Keep rolling window of last 20 readings for session-based scoring
        setSessionReadings(prev => {
          const next = [...prev, snapshot].slice(-20);
          setHealthResult(calculateHealthScore(next));
          return next;
        });
      } catch (e) {
        console.warn('[EngineHealth] Poll error:', e.message);
      }
    }, 3000);
  };

  useEffect(() => {
    const unsubscribe = OBDService.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        startPolling();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });

    if (OBDService.isConnected) {
      setIsConnected(true);
      startPolling();
    }

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Derived display values ────────────────────────────────────────────────
  const score       = healthResult.score;
  const issues      = healthResult.issues;
  const sampleCount = healthResult.sampleCount;

  const getHealthColor = () => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getHealthStatus = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Warning';
    return 'Critical';
  };

  // MAF/RPM ratio for display
  const mafRpmRatio = parameters?.rpm > 1000 && parameters?.maf > 0
    ? (parameters.maf / parameters.rpm).toFixed(4)
    : null;

  const mafRatioStatus = mafRpmRatio
    ? parseFloat(mafRpmRatio) < THRESHOLDS.mafRpmRatio.min
      ? { color: '#EF4444', label: 'Low — sensor check' }
      : parseFloat(mafRpmRatio) > THRESHOLDS.mafRpmRatio.max
        ? { color: '#F59E0B', label: 'High — check intake' }
        : { color: '#10B981', label: 'Normal' }
    : null;

  // O2 voltage range across session
  const o2Vals = sessionReadings.map(r => r.o2Bank1Sensor1).filter(v => v != null);
  const o2Range = o2Vals.length >= 2 ? (Math.max(...o2Vals) - Math.min(...o2Vals)).toFixed(3) : null;
  const o2RangeStatus = o2Range
    ? parseFloat(o2Range) < 0.2
      ? { color: '#EF4444', label: 'Critical — sensor failing' }
      : parseFloat(o2Range) < 0.4
        ? { color: '#F59E0B', label: 'Narrowing — monitor' }
        : { color: '#10B981', label: 'Normal swing' }
    : null;

  // ── Sub-components ────────────────────────────────────────────────────────
  const ParameterRow = ({ label, value, unit, paramKey }) => {
    if (value == null || isNaN(value)) return null;
    const { status, color } = getParamStatus(paramKey, value);
    return (
      <View style={styles.paramRow}>
        <Text style={styles.paramLabel}>{label}</Text>
        <Text style={styles.paramValue}>{value}{unit}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.paramStatus, { color }]}>{status}</Text>
        </View>
      </View>
    );
  };

  const SensorAnalysisRow = ({ label, value, status, color, note }) => (
    <View style={styles.analysisRow}>
      <View style={styles.analysisLeft}>
        <Text style={styles.analysisLabel}>{label}</Text>
        {note ? <Text style={styles.analysisNote}>{note}</Text> : null}
      </View>
      <View style={styles.analysisRight}>
        <Text style={[styles.analysisValue, { color }]}>{value}</Text>
        <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.paramStatus, { color }]}>{status}</Text>
        </View>
      </View>
    </View>
  );

  // ── Not connected state ───────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Engine Health</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.notConnectedBox}>
            <Ionicons name="bluetooth-outline" size={56} color="#D1D5DB" />
            <Text style={styles.notConnectedTitle}>OBD-II Not Connected</Text>
            <Text style={styles.notConnectedSub}>
              Connect your ELM327 adapter to analyse engine health in real time.
            </Text>
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={() => navigation.navigate('OBDConnection')}
            >
              <LinearGradient colors={['#8B0000', '#A00000']} style={styles.connectBtnGradient}>
                <Ionicons name="link-outline" size={20} color="#FFFFFF" />
                <Text style={styles.connectBtnText}>Connect Device</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Engine Health</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Health Score Card ──────────────────────────────────────── */}
          <View style={[styles.healthCard, { borderTopColor: getHealthColor() }]}>
            <View style={styles.healthHeader}>
              <View style={[styles.healthIconCircle, { backgroundColor: getHealthColor() + '20' }]}>
                <Ionicons name="heart" size={32} color={getHealthColor()} />
              </View>
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Engine Health Status</Text>
                <Text style={[styles.healthStatus, { color: getHealthColor() }]}>
                  {getHealthStatus()}
                </Text>
                <Text style={styles.healthSampleNote}>
                  Based on {sampleCount} sensor readings
                </Text>
              </View>
            </View>

            <View style={styles.scoreContainer}>
              <Text style={[styles.healthScore, { color: getHealthColor() }]}>{score}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${score}%`,
                backgroundColor: getHealthColor(),
              }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelText}>0 — Critical</Text>
              <Text style={styles.progressLabelText}>100 — Excellent</Text>
            </View>

            {lastUpdated && (
              <Text style={styles.lastUpdated}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Text>
            )}
          </View>

          {/* ── Sensor Analysis (PDF-based) ────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Ionicons name="flask" size={20} color="#8B0000" />
            <Text style={styles.sectionTitle}>Sensor Analysis</Text>
            <Text style={styles.sectionNote}>Ref: PDF Sections 3.3.4.1 & 3.3.4.2</Text>
          </View>

          <View style={styles.analysisCard}>
            <View style={styles.analysisCardBorder} />

            {/* MAF/RPM ratio */}
            <SensorAnalysisRow
              label="MAF / RPM Ratio"
              note="Healthy: 0.003 – 0.015 (linear relationship)"
              value={mafRpmRatio ? mafRpmRatio : 'Waiting...'}
              status={mafRatioStatus?.label ?? '—'}
              color={mafRatioStatus?.color ?? '#9CA3AF'}
            />
            <View style={styles.analysisDivider} />

            {/* O2 voltage range */}
            <SensorAnalysisRow
              label="O2 Sensor Voltage Range"
              note="Healthy swing: 0.1V → 0.9V (range ≥ 0.5V)"
              value={o2Range ? o2Range + ' V' : 'Waiting...'}
              status={o2RangeStatus?.label ?? '—'}
              color={o2RangeStatus?.color ?? '#9CA3AF'}
            />
            <View style={styles.analysisDivider} />

            {/* Load + Temp combined */}
            {parameters && (
              <SensorAnalysisRow
                label="Load + Temperature Risk"
                note="High load >65% with coolant >90°C = overheating risk"
                value={parameters.engineLoad != null && parameters.coolantTemp != null
                  ? parameters.engineLoad + '% / ' + parameters.coolantTemp + '°C'
                  : '—'}
                status={
                  parameters.engineLoad > 65 && parameters.coolantTemp > 90
                    ? 'Risk Detected'
                    : 'Safe'
                }
                color={
                  parameters.engineLoad > 65 && parameters.coolantTemp > 90
                    ? '#F59E0B'
                    : '#10B981'
                }
              />
            )}
          </View>

          {/* ── Live Parameters ────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color="#8B0000" />
            <Text style={styles.sectionTitle}>Live Parameters</Text>
          </View>

          {/* Engine Performance */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>⚙ Engine Performance</Text>
            <ParameterRow label="Engine RPM"        value={parameters?.rpm}        unit=""      paramKey="rpm" />
            <ParameterRow label="Engine Load"       value={parameters?.engineLoad} unit="%"     paramKey="engineLoad" />
            <ParameterRow label="Throttle Position" value={parameters?.throttle}   unit="%"     paramKey="throttle" />
            <ParameterRow label="Vehicle Speed"     value={parameters?.speed}      unit=" km/h" paramKey="speed" />
          </View>

          {/* Temperature */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>🌡 Temperature & Cooling</Text>
            <ParameterRow label="Coolant Temperature" value={parameters?.coolantTemp} unit="°C" paramKey="coolantTemp" />
            <ParameterRow label="Intake Air Temp"     value={parameters?.intakeTemp}  unit="°C" paramKey="intakeTemp" />
          </View>

          {/* Sensors */}
          <View style={styles.paramCard}>
            <View style={styles.paramCardBorder} />
            <Text style={styles.paramCardTitle}>📡 Sensor Readings</Text>
            <ParameterRow label="MAF Airflow"    value={parameters?.maf}            unit=" g/s" paramKey="maf" />
            <ParameterRow label="O2 Voltage B1S1" value={parameters?.o2Bank1Sensor1} unit=" V"  paramKey={null} />
            <ParameterRow label="Battery Voltage" value={parameters?.battery}        unit="V"   paramKey="battery" />
          </View>

          {/* ── Issues & Recommendations ───────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={20} color="#8B0000" />
            <Text style={styles.sectionTitle}>Diagnostics & Recommendations</Text>
          </View>

          <View style={styles.recommendCard}>
            <View style={styles.recommendCardBorder} />
            {issues.length === 0 ? (
              <View style={styles.recommendRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={[styles.recommendText, { color: '#10B981' }]}>
                  All engine systems operating normally across {sampleCount} readings.
                </Text>
              </View>
            ) : (
              issues.map((issue, i) => (
                <View key={i} style={[styles.recommendRow, i < issues.length - 1 && styles.recommendRowBorder]}>
                  <Ionicons
                    name={issue.type === 'critical' ? 'alert-circle' : issue.type === 'warning' ? 'warning' : 'information-circle'}
                    size={20}
                    color={issue.type === 'critical' ? '#EF4444' : issue.type === 'warning' ? '#F59E0B' : '#3B82F6'}
                  />
                  <Text style={[styles.recommendText, {
                    color: issue.type === 'critical' ? '#991B1B' : issue.type === 'warning' ? '#92400E' : '#1E3A5F',
                  }]}>
                    {issue.msg}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* ── Session Info ───────────────────────────────────────────── */}
          <View style={styles.sessionInfoCard}>
            {[
              { icon: 'layers-outline',    label: 'Readings in session',   value: sessionReadings.length + ' / 20' },
              { icon: 'time-outline',      label: 'Polling interval',      value: 'Every 3s' },
              { icon: 'shield-checkmark-outline', label: 'Analysis method', value: 'Session-based (PDF)' },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <View style={styles.infoLeft}>
                    <Ionicons name={row.icon} size={18} color="#6B7280" />
                    <Text style={styles.infoLabel}>{row.label}</Text>
                  </View>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.infoDivider} />}
              </View>
            ))}
          </View>

          {/* ── Action buttons ─────────────────────────────────────────── */}
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('FaultCodes')}>
              <LinearGradient colors={['#8B0000', '#A00000']} style={styles.actionGradient}>
                <Ionicons name="search" size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>Fault Codes</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('DataCharts', { isConnected: true })}>
              <LinearGradient colors={['#6B0000', '#8B0000']} style={styles.actionGradient}>
                <Ionicons name="analytics" size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>View Charts</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea:   { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  liveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  liveText:  { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  content:   { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  // Not connected
  notConnectedBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  notConnectedTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  notConnectedSub:   { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  connectBtn:        { width: '100%', borderRadius: 12, overflow: 'hidden' },
  connectBtnGradient:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  connectBtnText:    { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Health card
  healthCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB',
    borderTopWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  healthHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  healthIconCircle:  { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  healthInfo:        { flex: 1 },
  healthLabel:       { fontSize: 12, color: '#9CA3AF', marginBottom: 2 },
  healthStatus:      { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  healthSampleNote:  { fontSize: 11, color: '#9CA3AF' },
  scoreContainer:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 16 },
  healthScore:       { fontSize: 64, fontWeight: '800' },
  scoreMax:          { fontSize: 22, color: '#9CA3AF', marginLeft: 4 },
  progressBar:       { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill:      { height: '100%', borderRadius: 4 },
  progressLabels:    { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabelText: { fontSize: 10, color: '#9CA3AF' },
  lastUpdated:       { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#1F2937', flex: 1 },
  sectionNote:   { fontSize: 10, color: '#9CA3AF' },

  // Analysis card (PDF-based sensor analysis)
  analysisCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden',
  },
  analysisCardBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#3B82F6' },
  analysisRow:   { paddingVertical: 12 },
  analysisLeft:  { marginBottom: 8 },
  analysisLabel: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  analysisNote:  { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  analysisRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  analysisValue: { fontSize: 16, fontWeight: '700' },
  analysisDivider: { height: 1, backgroundColor: '#F3F4F6' },

  // Parameter cards
  paramCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden',
  },
  paramCardBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#8B0000' },
  paramCardTitle:  { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  paramRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  paramLabel:  { flex: 2, fontSize: 13, color: '#1F2937' },
  paramValue:  { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: '#6B7280' },
  statusBadge: { flex: 1, paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, alignItems: 'center' },
  paramStatus: { fontWeight: '600', fontSize: 11 },

  // Recommendations
  recommendCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB', position: 'relative', overflow: 'hidden',
  },
  recommendCardBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#8B0000' },
  recommendRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  recommendRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  recommendText:       { flex: 1, fontSize: 13, color: '#1F2937', lineHeight: 19 },

  // Session info
  sessionInfoCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  infoLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel:  { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  infoValue:  { fontSize: 13, fontWeight: '700', color: '#1F2937' },
  infoDivider:{ height: 1, backgroundColor: '#E5E7EB' },

  // Actions
  actionGrid:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionCard:    { flex: 1, borderRadius: 14, overflow: 'hidden' },
  actionGradient:{ padding: 18, alignItems: 'center', gap: 8 },
  actionText:    { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
});