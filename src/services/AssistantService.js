import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import OBDService from './OBDService';
import InspectionService from './InspectionService';
import MaintenanceService from './MaintenanceService';
import { getCodeInfo } from './FaultCodeDatabase';
import { INTENTS, FALLBACK, WELCOME_SUGGESTIONS } from '../data/chatbotKnowledge';

class AssistantService {
  constructor() {
    this._cache = {
      vehicle: null,
      vehicleAt: 0,
      inspections: null,
      inspectionsAt: 0,
      maintenance: null,
      maintenanceAt: 0,
    };
    this.CACHE_MS = 30 * 1000; // 30 seconds — context doesn't need to be real-time

    // Short conversation memory — last 5 exchanges so follow-up references work
    // ("and the coolant?", "what about that one?", "more details").
    this._history = [];
    this.MAX_HISTORY = 5;
    this._lastIntentId = null;
  }

  // ── Welcome message + suggestions ──────────────────────────────────────────
  getWelcome(vehicle) {
    const greet = INTENTS.find((i) => i.id === 'greeting');
    return greet.respond({ vehicle });
  }

  getInitialSuggestions() {
    return WELCOME_SUGGESTIONS;
  }

  // ── Main entry: process a user message ─────────────────────────────────────
  async processMessage(message) {
    const text = (message || '').trim();
    if (!text) {
      return { text: 'Please type a question to get started.', suggestions: WELCOME_SUGGESTIONS };
    }

    const ctx = await this.buildContext(text);
    const intent = this.matchIntent(text);

    if (!intent) {
      this._pushHistory({ role: 'user', text });
      this._pushHistory({ role: 'bot', text: FALLBACK.text });
      return { ...FALLBACK };
    }

    const reply = intent.respond({ message: text, ...ctx });
    this._lastIntentId = intent.id;
    this._pushHistory({ role: 'user', text });
    this._pushHistory({ role: 'bot', text: reply.text, intentId: intent.id });

    // Enrich with specific fault code lookup if requested
    if (reply.lookupCode) {
      const info = getCodeInfo(reply.lookupCode, ctx.vehicle?.brand);
      if (info) {
        reply.text =
          `${reply.lookupCode} — ${info.description}\n\n` +
          `Severity: ${info.severity || '—'}\n` +
          `Likely cause: ${info.cause || '—'}\n` +
          `Suggested fix: ${info.fix || '—'}` +
          (ctx.vehicle?.brand ? `\n\n(Description matched against ${ctx.vehicle.brand} brand-specific codes where available.)` : '');
      } else {
        reply.text = `I couldn't find ${reply.lookupCode} in my fault code database. Double-check the code on the Fault Codes screen.`;
      }
      delete reply.lookupCode;
    }

    return reply;
  }

  // ── Intent matching ────────────────────────────────────────────────────────
  // Each intent gets a score = (# matched keywords) + bonus for explicit test().
  // The intent with the highest score wins, must be > 0.
  // Uses light fuzzy matching so "couling temp", "battary", "feul" still hit.
  matchIntent(message) {
    const lower = message.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean);
    let best = null;
    let bestScore = 0;

    for (const intent of INTENTS) {
      let score = 0;

      // Exact regex test takes precedence (e.g. P0420 detection)
      if (typeof intent.test === 'function' && intent.test(message)) {
        score += 10;
      }

      if (Array.isArray(intent.keywords)) {
        for (const kw of intent.keywords) {
          const k = kw.toLowerCase();
          // Direct substring hit — strongest signal
          if (lower.includes(k)) {
            score += 1 + (k.length > 8 ? 0.5 : 0);
            continue;
          }
          // Fuzzy: tolerate one letter difference for keywords ≥ 5 chars,
          // catches typos like "couling" vs "coolant", "battary" vs "battery".
          if (k.length >= 5) {
            for (const t of tokens) {
              if (Math.abs(t.length - k.length) <= 1 && this._levenshtein(t, k) <= 1) {
                score += 0.6;
                break;
              }
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }

    return bestScore > 0 ? best : null;
  }

  // Lightweight Levenshtein for typo tolerance. Capped at distance 2 for speed.
  _levenshtein(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 99;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  // ── Build the live context the intent handlers consume ─────────────────────
  async buildContext() {
    const [vehicle, inspections] = await Promise.all([
      this.getVehicle(),
      this.getInspections(),
    ]);

    // Pull maintenance schedule (cached); needs vehicle to know engine type
    const maintenance = await this.getMaintenance(vehicle?.engineType);

    const obdConnected = OBDService.isConnected;
    let ecuSnapshot = null;
    let faultCodes = [];

    if (obdConnected) {
      try {
        ecuSnapshot = await OBDService.getSensorData();
      } catch {
        ecuSnapshot = null;
      }
      try {
        faultCodes = await OBDService.getFaultCodes(vehicle?.brand);
      } catch {
        faultCodes = [];
      }
    } else {
      // If not connected, fall back to the fault codes saved in the latest inspection
      const last = inspections[0];
      if (last?.faultCodes?.length) faultCodes = last.faultCodes;
      if (last?.ecuSnapshot) ecuSnapshot = last.ecuSnapshot;
    }

    return {
      vehicle,
      inspections,
      latestInspection: inspections[0] || null,
      obdConnected,
      ecuSnapshot,
      faultCodes,
      maintenance,                          // full schedule with statuses
      history: this._history,               // last N exchanges
      lastIntentId: this._lastIntentId,     // for follow-up handling
    };
  }

  // ── Maintenance schedule (cached) ──────────────────────────────────────────
  async getMaintenance(engineType) {
    const now = Date.now();
    if (this._cache.maintenance && now - this._cache.maintenanceAt < this.CACHE_MS) {
      return this._cache.maintenance;
    }
    try {
      const schedule = await MaintenanceService.getSchedule(engineType || 'Diesel');
      this._cache.maintenance = schedule;
      this._cache.maintenanceAt = now;
      return schedule;
    } catch {
      return null;
    }
  }

  // ── Vehicle (cached) ───────────────────────────────────────────────────────
  async getVehicle() {
    const now = Date.now();
    if (this._cache.vehicle && now - this._cache.vehicleAt < this.CACHE_MS) {
      return this._cache.vehicle;
    }
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return null;
      const userVehicleSnap = await getDoc(doc(db, 'userVehicles', userId));
      if (!userVehicleSnap.exists()) return null;
      const vehicleId = userVehicleSnap.data().vehicleId;
      if (!vehicleId) return null;
      const vehicleSnap = await getDoc(doc(db, 'vehicles', vehicleId));
      if (!vehicleSnap.exists()) return null;
      const v = vehicleSnap.data();
      this._cache.vehicle = v;
      this._cache.vehicleAt = now;
      return v;
    } catch {
      return null;
    }
  }

  // ── Inspections (cached) ───────────────────────────────────────────────────
  async getInspections() {
    const now = Date.now();
    if (this._cache.inspections && now - this._cache.inspectionsAt < this.CACHE_MS) {
      return this._cache.inspections;
    }
    try {
      const list = await InspectionService.listInspections();
      this._cache.inspections = list;
      this._cache.inspectionsAt = now;
      return list;
    } catch {
      return [];
    }
  }

  // Force-clear the cache (e.g. after a new inspection saved)
  invalidateCache() {
    this._cache.vehicle = null;
    this._cache.vehicleAt = 0;
    this._cache.inspections = null;
    this._cache.inspectionsAt = 0;
    this._cache.maintenance = null;
    this._cache.maintenanceAt = 0;
  }

  // ── Conversation memory ───────────────────────────────────────────────────
  // Keep a rolling window of the last MAX_HISTORY × 2 messages (user + bot)
  // so intent handlers can see what was just discussed and resolve follow-ups
  // like "and the coolant?" or "more details".
  _pushHistory(entry) {
    this._history.push({ ...entry, ts: Date.now() });
    const cap = this.MAX_HISTORY * 2;
    if (this._history.length > cap) {
      this._history = this._history.slice(-cap);
    }
  }

  resetConversation() {
    this._history = [];
    this._lastIntentId = null;
  }
}

export default new AssistantService();
