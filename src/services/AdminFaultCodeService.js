import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { setAdminOverrides } from './FaultCodeDatabase';

const COLLECTION = 'faultCodesAdmin';

class AdminFaultCodeService {
  // Load every admin-managed code from Firestore and push them into the
  // FaultCodeDatabase override map. Call once at app start, and again after
  // any admin edit.
  async refreshOverrides() {
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const code = (data.code || d.id).toUpperCase();
        map[code] = {
          description: data.description || '',
          severity:    data.severity    || 'Warning',
          cause:       data.cause       || '',
          fix:         data.fix         || '',
          brand:       data.brand       || 'Generic OBD-II',
        };
      });
      setAdminOverrides(map);
      return Object.keys(map).length;
    } catch (e) {
      console.warn('AdminFaultCodeService.refreshOverrides failed:', e.message);
      return 0;
    }
  }

  async listCodes() {
    const snap = await getDocs(collection(db, COLLECTION));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }

  async upsertCode({ code, description, severity, cause, fix, brand }) {
    const upper = String(code).toUpperCase().trim();
    if (!upper) throw new Error('Code is required');
    if (!description?.trim()) throw new Error('Description is required');
    await setDoc(doc(db, COLLECTION, upper), {
      code: upper,
      description: description.trim(),
      severity: severity || 'Warning',
      cause: (cause || '').trim(),
      fix: (fix || '').trim(),
      brand: (brand || 'Generic OBD-II').trim(),
      updatedAt: serverTimestamp(),
    });
    await this.refreshOverrides();
    return upper;
  }

  async deleteCode(code) {
    const upper = String(code).toUpperCase().trim();
    await deleteDoc(doc(db, COLLECTION, upper));
    await this.refreshOverrides();
  }
}

export default new AdminFaultCodeService();
