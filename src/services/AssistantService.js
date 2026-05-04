import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import OBDService from './OBDService';
import InspectionService from './InspectionService';
import { getCodeInfo } from './FaultCodeDatabase';
import { INTENTS, FALLBACK, WELCOME_SUGGESTIONS } from '../data/chatbotKnowledge';

class AssistantService {
  constructor() {
    this._cache = {
      vehicle: null,
      vehicleAt: 0,
      inspections: null,
      inspectionsAt: 0,
    };
    this.CACHE_MS = 30 * 1000; // 30 seconds — context doesn't need to be real-time
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
      return { ...FALLBACK };
    }

    const reply = intent.respond({ message: text, ...ctx });

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
  matchIntent(message) {
    const lower = message.toLowerCase();
    let best = null;
    let bestScore = 0;

    for (const intent of INTENTS) {
      let score = 0;

      // Exact regex test takes precedence (e.g. P0420 detection)
      if (typeof intent.test === 'function' && intent.test(message)) {
        score += 10;
      }

      // Keyword score — each matched keyword adds 1, longer keywords add a small bonus
      if (Array.isArray(intent.keywords)) {
        for (const kw of intent.keywords) {
          if (lower.includes(kw.toLowerCase())) {
            score += 1 + (kw.length > 8 ? 0.5 : 0);
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

  // ── Build the live context the intent handlers consume ─────────────────────
  async buildContext() {
    const [vehicle, inspections] = await Promise.all([
      this.getVehicle(),
      this.getInspections(),
    ]);

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
    };
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
  }
}

export default new AssistantService();
