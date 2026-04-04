import { db, auth } from '../config/firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────
//  DataCollectorService
//  Records labeled OBD sensor sessions for
//  training the engine health TensorFlow model
// ─────────────────────────────────────────────

class DataCollectorService {
  constructor() {
    this.isRecording = false;
    this.sessionData = [];     // raw snapshots during session
    this.intervalRef = null;
    this.sessionId = null;
    this.SAMPLE_INTERVAL_MS = 5000; // record every 5 seconds
  }

  // ── Start a recording session ──────────────────────────────────────────
  startSession() {
    if (this.isRecording) return;
    this.isRecording = true;
    this.sessionData = [];
    this.sessionId = `session_${Date.now()}`;
    console.log('[DataCollector] Session started:', this.sessionId);
  }

  // ── Record one snapshot of sensor data ────────────────────────────────
  // Call this from your Dashboard polling loop or EngineHealthScreen
  recordSnapshot(sensorData) {
    if (!this.isRecording) return;

    const snapshot = {
      rpm:         parseFloat(sensorData.rpm)         || 0,
      speed:       parseFloat(sensorData.speed)       || 0,
      coolantTemp: parseFloat(sensorData.coolantTemp) || 0,
      throttle:    parseFloat(sensorData.throttle)    || 0,
      fuelLevel:   parseFloat(sensorData.fuelLevel)   || 0,
      engineLoad:  parseFloat(sensorData.engineLoad)  || 0,
      voltage:     parseFloat(sensorData.voltage)     || 0,
      timestamp:   Date.now(),
    };

    this.sessionData.push(snapshot);
    console.log(`[DataCollector] Snapshot #${this.sessionData.length} recorded`);
  }

  // ── Stop session and return snapshot count ─────────────────────────────
  stopSession() {
    if (!this.isRecording) return 0;
    this.isRecording = false;
    console.log('[DataCollector] Session stopped. Snapshots:', this.sessionData.length);
    return this.sessionData.length;
  }

  // ── Save labeled session to Firestore ─────────────────────────────────
  // label: 'Normal' | 'Warning' | 'Critical'
  async saveLabeledSession(label, vehicleBrand = 'Unknown') {
    if (this.sessionData.length === 0) {
      throw new Error('No data recorded in this session.');
    }

    const userId = auth.currentUser?.uid || 'anonymous';

    // Calculate session averages — these are the feature vectors
    const avg = this._calculateAverages(this.sessionData);

    // Build the training record
    const trainingRecord = {
      sessionId:    this.sessionId,
      userId,
      vehicleBrand,
      label,                  // ← the training label (Normal/Warning/Critical)
      snapshotCount: this.sessionData.length,
      duration_ms:  this.sessionData[this.sessionData.length - 1].timestamp
                    - this.sessionData[0].timestamp,
      // Averaged feature values (used as model input features)
      avg_rpm:         avg.rpm,
      avg_speed:       avg.speed,
      avg_coolantTemp: avg.coolantTemp,
      avg_throttle:    avg.throttle,
      avg_fuelLevel:   avg.fuelLevel,
      avg_engineLoad:  avg.engineLoad,
      avg_voltage:     avg.voltage,
      // Min/Max for additional features
      max_rpm:         Math.max(...this.sessionData.map(s => s.rpm)),
      max_coolantTemp: Math.max(...this.sessionData.map(s => s.coolantTemp)),
      min_voltage:     Math.min(...this.sessionData.map(s => s.voltage)),
      // Raw snapshots stored separately for deep analysis
      rawSnapshots: this.sessionData,
      createdAt: serverTimestamp(),
    };

    // Save to Firestore under 'trainingData' collection
    await addDoc(collection(db, 'trainingData'), trainingRecord);

    console.log('[DataCollector] Saved training record:', this.sessionId, '| Label:', label);

    // Clear session after saving
    this.sessionData = [];
    this.sessionId = null;

    return trainingRecord;
  }

  // ── Discard current session without saving ─────────────────────────────
  discardSession() {
    this.isRecording = false;
    this.sessionData = [];
    this.sessionId = null;
    console.log('[DataCollector] Session discarded');
  }
  

  // ── Helper: calculate averages from snapshots ─────────────────────────
  _calculateAverages(snapshots) {
    const keys = ['rpm', 'speed', 'coolantTemp', 'throttle', 'fuelLevel', 'engineLoad', 'voltage'];
    const avg = {};
    keys.forEach(key => {
      const sum = snapshots.reduce((acc, s) => acc + (s[key] || 0), 0);
      avg[key] = parseFloat((sum / snapshots.length).toFixed(2));
    });
    return avg;
  }

  // ── Get current session snapshot count ────────────────────────────────
  getSnapshotCount() {
    return this.sessionData.length;
  }

  // ── Check if recording ─────────────────────────────────────────────────
  get recording() {
    return this.isRecording;
  }
  
}

export default new DataCollectorService();
