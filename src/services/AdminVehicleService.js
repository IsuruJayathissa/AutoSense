import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'vehicles';

class AdminVehicleService {
  async listVehicles() {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const sa = `${a.brand || ''} ${a.model || ''}`.trim();
        const sb = `${b.brand || ''} ${b.model || ''}`.trim();
        return sa.localeCompare(sb);
      });
  }

  // id is the Firestore doc id. For new vehicles we generate one from
  // brand+model+year (e.g. "toyota_hiace_2008"). On edit we re-use the existing id.
  async upsertVehicle({ id, brand, model, year, engineType, vehicleNumber }) {
    if (!brand?.trim() || !model?.trim()) {
      throw new Error('Brand and model are required');
    }
    const docId =
      id ||
      `${brand}_${model}_${year || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');

    await setDoc(
      doc(db, COLLECTION, docId),
      {
        vehicleId:     docId,
        brand:         brand.trim(),
        model:         model.trim(),
        year:          year ? String(year).trim() : null,
        engineType:    engineType?.trim() || null,
        vehicleNumber: vehicleNumber?.trim() || null,
        updatedAt:     serverTimestamp(),
      },
      { merge: true }
    );
    return docId;
  }

  async deleteVehicle(id) {
    if (!id) throw new Error('Vehicle id required');
    await deleteDoc(doc(db, COLLECTION, id));
  }
}

export default new AdminVehicleService();
