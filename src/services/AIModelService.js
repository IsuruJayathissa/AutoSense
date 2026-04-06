import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────────────────
const MODEL_WEIGHTS_KEY = 'autosense_ai_weights_v1';

const LABEL_MAP   = { Normal: 0, Warning: 1, Critical: 2 };
const LABEL_NAMES = ['Normal', 'Warning', 'Critical'];

// 5 features used for training (session averages from Firestore)
// and for live inference (real-time OBD sensor readings)
const NORM = {
  rpm:         { min: 0,   max: 8000 },
  coolantTemp: { min: -40, max: 150  },
  engineLoad:  { min: 0,   max: 100  },
  throttle:    { min: 0,   max: 100  },
  voltage:     { min: 9,   max: 16   },
};

const normalizeValue = (val, min, max) =>
  Math.min(1, Math.max(0, (val - min) / (max - min)));

// ─────────────────────────────────────────────────────────────────────────────
//  AIModelService
// ─────────────────────────────────────────────────────────────────────────────
class AIModelService {
  constructor() {
    this.model      = null;
    this.isTrained  = false;
    this.lastAccuracy = null;
    this.isReady    = false;
    this._initPromise = this._init();
  }

  // ── Initialise TF.js backend ──────────────────────────────────────────────
  async _init() {
    try {
      await tf.setBackend('cpu');
      await tf.ready();
      this.isReady = true;
      await this._tryLoadSavedModel();
    } catch (e) {
      console.warn('AI: Init error:', e.message);
    }
  }

  ready() { return this._initPromise; }

  // ── Build the neural network ──────────────────────────────────────────────
  // Architecture:  5 → Dense(16,relu) → Dropout(0.2) → Dense(8,relu) → Dense(3,softmax)
  _buildModel() {
    const m = tf.sequential();
    m.add(tf.layers.dense({ inputShape: [5], units: 16, activation: 'relu' }));
    m.add(tf.layers.dropout({ rate: 0.2 }));
    m.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    m.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
    m.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    return m;
  }

  // ── Normalise a Firestore training record into a feature vector ───────────
  _recordToFeatures(r) {
    return [
      normalizeValue(r.avg_rpm         || 0, NORM.rpm.min,         NORM.rpm.max),
      normalizeValue(r.avg_coolantTemp  || 0, NORM.coolantTemp.min, NORM.coolantTemp.max),
      normalizeValue(r.avg_engineLoad   || 0, NORM.engineLoad.min,  NORM.engineLoad.max),
      normalizeValue(r.avg_throttle     || 0, NORM.throttle.min,    NORM.throttle.max),
      normalizeValue(r.avg_voltage      || 0, NORM.voltage.min,     NORM.voltage.max),
    ];
  }

  // ── Normalise live OBD sensor data into a feature vector ─────────────────
  _sensorToFeatures(s) {
    return [
      normalizeValue(s.rpm         || 0, NORM.rpm.min,         NORM.rpm.max),
      normalizeValue(s.coolantTemp || 0, NORM.coolantTemp.min, NORM.coolantTemp.max),
      normalizeValue(s.engineLoad  || 0, NORM.engineLoad.min,  NORM.engineLoad.max),
      normalizeValue(s.throttle    || 0, NORM.throttle.min,    NORM.throttle.max),
      normalizeValue(s.voltage     || 0, NORM.voltage.min,     NORM.voltage.max),
    ];
  }

  // ── Fetch labeled training records from Firestore ─────────────────────────
  async fetchTrainingRecords() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Not logged in');

    const snap = await getDocs(
      query(collection(db, 'trainingData'), where('userId', '==', userId))
    );
    return snap.docs.map(d => d.data());
  }

  // ── Train the model ───────────────────────────────────────────────────────
  // onProgress(epoch, totalEpochs, loss, accuracy) — called each epoch
  async train(onProgress) {
    await this.ready();

    const records = await this.fetchTrainingRecords();
    if (records.length < 5) {
      throw new Error(
        `Need at least 5 labeled sessions to train. You have ${records.length}.\n` +
        'Record more sessions in Data Collection screen.'
      );
    }

    const xs = records.map(r => this._recordToFeatures(r));
    const ys = records.map(r => {
      const idx = LABEL_MAP[r.label] ?? 0;
      return LABEL_NAMES.map((_, i) => (i === idx ? 1 : 0));
    });

    const xTensor = tf.tensor2d(xs);
    const yTensor = tf.tensor2d(ys);

    const EPOCHS = 80;

    if (this.model) this.model.dispose();
    this.model = this._buildModel();

    const history = await this.model.fit(xTensor, yTensor, {
      epochs:          EPOCHS,
      batchSize:       Math.min(8, records.length),
      validationSplit: records.length >= 10 ? 0.2 : 0,
      shuffle:         true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const acc = logs.acc ?? logs.accuracy ?? 0;
          onProgress && onProgress(epoch + 1, EPOCHS, logs.loss, acc);
        },
      },
    });

    xTensor.dispose();
    yTensor.dispose();

    const finalLogs = history.history;
    const accArr    = finalLogs.acc || finalLogs.accuracy || [];
    this.lastAccuracy = accArr.length
      ? Math.round(accArr[accArr.length - 1] * 100)
      : null;
    this.isTrained = true;

    await this._saveModel();
    return { accuracy: this.lastAccuracy, sessions: records.length };
  }

  // ── Run inference on live sensor data ─────────────────────────────────────
  // Returns: { label, confidence, probabilities: { Normal, Warning, Critical } }
  predict(sensorData) {
    if (!this.model || !this.isTrained) return null;

    const features = this._sensorToFeatures(sensorData);
    const input    = tf.tensor2d([features]);
    const output   = this.model.predict(input);
    const probs    = Array.from(output.dataSync());
    input.dispose();
    output.dispose();

    const maxIdx = probs.indexOf(Math.max(...probs));
    return {
      label:      LABEL_NAMES[maxIdx],
      confidence: Math.round(probs[maxIdx] * 100),
      probabilities: {
        Normal:   Math.round(probs[0] * 100),
        Warning:  Math.round(probs[1] * 100),
        Critical: Math.round(probs[2] * 100),
      },
    };
  }

  // ── Persist model weights to AsyncStorage ─────────────────────────────────
  async _saveModel() {
    try {
      const weights = this.model.getWeights();
      const data    = weights.map(w => ({ shape: w.shape, data: Array.from(w.dataSync()) }));
      await AsyncStorage.setItem(MODEL_WEIGHTS_KEY, JSON.stringify(data));
      weights.forEach(w => w.dispose());
      console.log('AI: Model saved to AsyncStorage');
    } catch (e) {
      console.warn('AI: Save failed:', e.message);
    }
  }

  // ── Restore model weights from AsyncStorage ───────────────────────────────
  async _tryLoadSavedModel() {
    try {
      const raw = await AsyncStorage.getItem(MODEL_WEIGHTS_KEY);
      if (!raw) return;

      const data    = JSON.parse(raw);
      this.model    = this._buildModel();
      const tensors = data.map(w => tf.tensor(w.data, w.shape));
      this.model.setWeights(tensors);
      tensors.forEach(t => t.dispose());

      this.isTrained = true;
      console.log('AI: Restored saved model from AsyncStorage');
    } catch (e) {
      console.warn('AI: Load failed:', e.message);
    }
  }

  // ── Reset — clears model and saved weights ────────────────────────────────
  async reset() {
    await AsyncStorage.removeItem(MODEL_WEIGHTS_KEY);
    if (this.model) { this.model.dispose(); this.model = null; }
    this.isTrained    = false;
    this.lastAccuracy = null;
  }
}

export default new AIModelService();
