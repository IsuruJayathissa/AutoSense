import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { summarizeResults } from '../data/inspectionChecklist';
import MaintenanceService from './MaintenanceService';

const COLLECTION = 'inspections';

class InspectionService {
  // Persist a completed inspection to Firestore.
  // Returns the new inspection document ID.
  async saveInspection({
    vehicle,
    inspectorName,
    odometer,
    results,
    ecuSnapshot,
    healthScore,
    faultCodes,
    notes,
  }) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Not signed in');

    const summary = summarizeResults(results);
    const inspectionId = `INS_${Date.now()}`;

    const payload = {
      inspectionId,
      userId,
      vehicleId:     vehicle?.vehicleId     || null,
      vehicleNumber: vehicle?.vehicleNumber || null,
      brand:         vehicle?.brand         || null,
      model:         vehicle?.model         || null,
      year:          vehicle?.year          || null,
      engineType:    vehicle?.engineType    || null,
      inspectorName: inspectorName?.trim()  || null,
      odometer:      odometer?.trim()       || null,
      results:       results || {},
      ecuSnapshot:   ecuSnapshot || null,
      healthScore:   healthScore ?? null,
      faultCodes:    faultCodes || [],
      summary,
      notes:         notes?.trim() || null,
      createdAt:     serverTimestamp(),
    };

    await setDoc(doc(db, COLLECTION, inspectionId), payload);

    // Automatically refresh the maintenance schedule's current mileage so the
    // home-page card and the schedule screen reflect this new reading.
    if (odometer && String(odometer).trim()) {
      try {
        await MaintenanceService.updateMileage(odometer);
      } catch (e) {
        console.warn('Maintenance schedule update failed:', e.message);
      }
    }

    return inspectionId;
  }

  // Load all inspections for the signed-in user, newest first.
  // Sorted client-side to avoid the where + orderBy composite-index requirement.
  async listInspections() {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];

    const q = query(
      collection(db, COLLECTION),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    return docs;
  }

  // Delete every inspection belonging to the signed-in user.
  // Returns the number of records removed.
  async clearAllInspections() {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Not signed in');

    const q = query(collection(db, COLLECTION), where('userId', '==', userId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, COLLECTION, d.id))));
    return snap.docs.length;
  }
}

export default new InspectionService();
