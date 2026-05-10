import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const COLLECTION = 'maintenanceSchedules';

// Standard maintenance items. intervalKm is the diesel default;
// intervalKmPetrol overrides for petrol/hybrid.
export const MAINTENANCE_ITEMS = {
  engineOil:        { name: 'Engine Oil & Filter',  icon: 'water',         intervalKm: 5000,   intervalKmPetrol: 10000, critical: true  },
  airFilter:        { name: 'Air Filter',           icon: 'cloud',         intervalKm: 15000,                          critical: false },
  fuelFilter:       { name: 'Fuel Filter',          icon: 'flame',         intervalKm: 20000,  intervalKmPetrol: 40000, critical: true  },
  cabinFilter:      { name: 'Cabin Air Filter',     icon: 'snow',          intervalKm: 20000,                          critical: false },
  brakeFluid:       { name: 'Brake Fluid',          icon: 'warning',       intervalKm: 40000,                          critical: true  },
  coolant:          { name: 'Coolant Flush',        icon: 'thermometer',   intervalKm: 40000,                          critical: true  },
  tireRotation:     { name: 'Tire Rotation',        icon: 'disc',          intervalKm: 10000,                          critical: false },
  transmissionFluid:{ name: 'Transmission Fluid',   icon: 'cog',           intervalKm: 60000,                          critical: true  },
  sparkPlugs:       { name: 'Spark Plugs',          icon: 'flash',         intervalKm: 40000,                          critical: false, petrolOnly: true },
};

// Resolve the right interval for a given engine type
const intervalFor = (key, engineType) => {
  const item = MAINTENANCE_ITEMS[key];
  if (!item) return null;
  const isPetrol = (engineType || '').toLowerCase().includes('petrol') ||
                   (engineType || '').toLowerCase().includes('hybrid');
  return isPetrol && item.intervalKmPetrol ? item.intervalKmPetrol : item.intervalKm;
};

// Compute status for one item given current mileage
const computeStatus = (currentMileage, lastServiceKm, intervalKm) => {
  const nextDueKm = lastServiceKm + intervalKm;
  const kmUntilDue = nextDueKm - currentMileage;
  let status = 'ok';
  if (kmUntilDue <= 0) status = 'overdue';
  else if (kmUntilDue <= intervalKm * 0.1) status = 'due_soon';
  return { nextDueKm, kmUntilDue, status };
};

class MaintenanceService {
  // Load (and lazily create) the schedule for the current user.
  // engineType is used to select correct intervals; pass from vehicle profile.
  async getSchedule(engineType = 'Diesel') {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    const ref = doc(db, COLLECTION, userId);
    const snap = await getDoc(ref);
    let data;
    if (snap.exists()) {
      data = snap.data();
    } else {
      data = await this._initializeSchedule(userId, engineType);
    }

    // Filter out items not applicable to this engine type
    const applicable = Object.keys(MAINTENANCE_ITEMS).filter(key => {
      const item = MAINTENANCE_ITEMS[key];
      const isPetrol = (engineType || '').toLowerCase().includes('petrol') ||
                       (engineType || '').toLowerCase().includes('hybrid');
      if (item.petrolOnly && !isPetrol) return false;
      return true;
    });

    const items = applicable.map(key => {
      const def = MAINTENANCE_ITEMS[key];
      const interval = intervalFor(key, engineType);
      const lastServiceKm = data.items?.[key]?.lastServiceKm ?? data.currentMileage ?? 0;
      const lastServiceDate = data.items?.[key]?.lastServiceDate ?? null;
      const { nextDueKm, kmUntilDue, status } = computeStatus(
        data.currentMileage || 0,
        lastServiceKm,
        interval
      );
      return {
        key,
        ...def,
        intervalKm: interval,
        lastServiceKm,
        lastServiceDate,
        nextDueKm,
        kmUntilDue,
        status,
      };
    });

    // Sort: overdue → due_soon → ok, then by km until due ascending
    const order = { overdue: 0, due_soon: 1, ok: 2 };
    items.sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.kmUntilDue - b.kmUntilDue;
    });

    return {
      currentMileage: data.currentMileage || 0,
      lastUpdated: data.lastUpdated || null,
      items,
    };
  }

  // Initialize: every item's last service is set to the current mileage so
  // none start as "overdue". User can mark history later via the UI.
  async _initializeSchedule(userId, engineType) {
    const ref = doc(db, COLLECTION, userId);
    const items = {};
    Object.keys(MAINTENANCE_ITEMS).forEach(key => {
      items[key] = { lastServiceKm: 0, lastServiceDate: null };
    });
    const initial = {
      userId,
      currentMileage: 0,
      engineType,
      items,
      lastUpdated: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
    return initial;
  }

  // Update the schedule's current mileage. Called automatically from
  // InspectionService.saveInspection when an odometer reading is recorded.
  async updateMileage(km) {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const parsed = parseInt(String(km).replace(/[^\d]/g, ''), 10);
    if (!parsed || parsed <= 0) return;

    const ref = doc(db, COLLECTION, userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Lazily create with this mileage as the baseline
      const items = {};
      Object.keys(MAINTENANCE_ITEMS).forEach(key => {
        items[key] = { lastServiceKm: parsed, lastServiceDate: null };
      });
      await setDoc(ref, {
        userId,
        currentMileage: parsed,
        items,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      return;
    }

    const existing = snap.data().currentMileage || 0;
    // Don't go backwards — a later inspection should always have higher km
    if (parsed < existing) {
      console.warn(`Maintenance: refusing to decrease mileage (${existing} → ${parsed})`);
      return;
    }
    await updateDoc(ref, {
      currentMileage: parsed,
      lastUpdated: serverTimestamp(),
    });
  }

  // Mark an item as just serviced at the current mileage.
  async markServiced(itemKey, atMileage = null) {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const ref = doc(db, COLLECTION, userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const km = atMileage ?? data.currentMileage ?? 0;
    const items = { ...(data.items || {}) };
    items[itemKey] = {
      lastServiceKm: parseInt(km, 10),
      lastServiceDate: new Date().toISOString(),
    };
    await updateDoc(ref, {
      items,
      lastUpdated: serverTimestamp(),
    });
  }

  // Wipe every item's service history. Each item's lastServiceKm is reset to
  // the current mileage so everything reads as "just serviced" (status: ok).
  async resetServiceHistory() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Not signed in');
    const ref = doc(db, COLLECTION, userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 0;
    const data = snap.data();
    const km = data.currentMileage || 0;
    const items = {};
    Object.keys(MAINTENANCE_ITEMS).forEach((key) => {
      items[key] = { lastServiceKm: km, lastServiceDate: null };
    });
    await updateDoc(ref, {
      items,
      lastUpdated: serverTimestamp(),
    });
    return Object.keys(items).length;
  }

  // Convenience: most pressing item to surface on the home page
  async getNextDueItem(engineType) {
    const schedule = await this.getSchedule(engineType);
    if (!schedule || !schedule.items.length) return null;
    return schedule.items[0]; // already sorted: overdue first
  }
}

export default new MaintenanceService();
