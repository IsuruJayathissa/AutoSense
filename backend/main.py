"""
AutoSense Backend API — FastAPI + Firebase Admin
Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Firebase initialisation ────────────────────────────────────────────────────
_SERVICE_ACCOUNT = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(_SERVICE_ACCOUNT)
        firebase_admin.initialize_app(cred)
        print(f"[AutoSense] Firebase initialised from {_SERVICE_ACCOUNT}")
    except Exception as e:
        print(f"[AutoSense] Firebase init warning: {e}")
        print("[AutoSense] Running without Firebase — /training-data endpoints will fail")

def get_db():
    return firestore.client()

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AutoSense Backend API",
    description="Smart Vehicle Diagnostic — server-side endpoints for training data, DTC lookup, and stats.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ────────────────────────────────────────────────────────────
class TrainingRecord(BaseModel):
    userId: str
    sessionId: str
    label: str                    # Normal | Warning | Critical
    vehicleBrand: Optional[str] = "Unknown"
    avg_rpm: Optional[float]      = 0
    avg_coolantTemp: Optional[float] = 0
    avg_engineLoad: Optional[float]  = 0
    avg_throttle: Optional[float]    = 0
    avg_voltage: Optional[float]     = 0
    avg_speed: Optional[float]       = 0
    avg_fuelLevel: Optional[float]   = 0
    snapshotCount: Optional[int]     = 0

class DtcLookupRequest(BaseModel):
    code: str
    brand: Optional[str] = None

class PredictRequest(BaseModel):
    rpm: float
    coolantTemp: float
    engineLoad: float
    throttle: float
    voltage: float

# ── DTC database (server-side subset for quick API lookup) ─────────────────────
_DTC_DB: dict[str, dict] = {
    "P0100": {"description": "Mass Air Flow Circuit Malfunction",           "severity": "Warning",  "cause": "Faulty MAF sensor",                      "fix": "Clean or replace MAF sensor"},
    "P0101": {"description": "MAF Circuit Range/Performance",               "severity": "Warning",  "cause": "Dirty MAF or air leak",                  "fix": "Clean MAF, check vacuum leaks"},
    "P0115": {"description": "Engine Coolant Temp Circuit Malfunction",     "severity": "Warning",  "cause": "Faulty ECT sensor",                      "fix": "Replace coolant temp sensor"},
    "P0130": {"description": "O2 Sensor Circuit Malfunction (B1S1)",        "severity": "Warning",  "cause": "Faulty oxygen sensor",                   "fix": "Replace O2 sensor"},
    "P0171": {"description": "System Too Lean (Bank 1)",                    "severity": "Warning",  "cause": "Vacuum leak or fuel delivery issue",      "fix": "Check vacuum lines, MAF, fuel filter"},
    "P0172": {"description": "System Too Rich (Bank 1)",                    "severity": "Warning",  "cause": "Faulty O2 or injector",                  "fix": "Check fuel injectors and O2 sensors"},
    "P0300": {"description": "Random/Multiple Cylinder Misfire Detected",   "severity": "Critical", "cause": "Spark plugs, coils, or compression",     "fix": "Check spark plugs, coils, and injectors"},
    "P0301": {"description": "Cylinder 1 Misfire Detected",                 "severity": "Critical", "cause": "Faulty spark plug or coil",              "fix": "Replace spark plug and coil cyl 1"},
    "P0302": {"description": "Cylinder 2 Misfire Detected",                 "severity": "Critical", "cause": "Faulty spark plug or coil",              "fix": "Replace spark plug and coil cyl 2"},
    "P0303": {"description": "Cylinder 3 Misfire Detected",                 "severity": "Critical", "cause": "Faulty spark plug or coil",              "fix": "Replace spark plug and coil cyl 3"},
    "P0304": {"description": "Cylinder 4 Misfire Detected",                 "severity": "Critical", "cause": "Faulty spark plug or coil",              "fix": "Replace spark plug and coil cyl 4"},
    "P0325": {"description": "Knock Sensor Circuit Malfunction (Bank 1)",   "severity": "Warning",  "cause": "Faulty knock sensor",                    "fix": "Replace knock sensor"},
    "P0335": {"description": "Crankshaft Position Sensor Circuit",          "severity": "Critical", "cause": "Faulty CKP sensor",                      "fix": "Replace crankshaft position sensor"},
    "P0401": {"description": "EGR Flow Insufficient",                       "severity": "Warning",  "cause": "Clogged EGR valve",                      "fix": "Clean or replace EGR valve"},
    "P0420": {"description": "Catalyst Efficiency Below Threshold (B1)",    "severity": "Warning",  "cause": "Failing catalytic converter",             "fix": "Replace catalytic converter"},
    "P0440": {"description": "EVAP Control System Malfunction",             "severity": "Info",     "cause": "Loose gas cap or EVAP leak",             "fix": "Tighten gas cap, check EVAP system"},
    "P0500": {"description": "Vehicle Speed Sensor Malfunction",            "severity": "Warning",  "cause": "Faulty VSS",                             "fix": "Replace vehicle speed sensor"},
    "P0562": {"description": "System Voltage Low",                          "severity": "Warning",  "cause": "Weak battery or alternator issue",        "fix": "Test battery and alternator"},
    "P0600": {"description": "Serial Communication Link Malfunction",       "severity": "Critical", "cause": "ECU communication error",                "fix": "Check ECU connections"},
    "P0700": {"description": "Transmission Control System Malfunction",     "severity": "Warning",  "cause": "TCM issue",                              "fix": "Scan transmission codes"},
}

_SEVERITY_COLOR = {"Critical": "#DC2626", "Warning": "#F59E0B", "Info": "#10B981"}

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "AutoSense API",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }

# ── DTC lookup ─────────────────────────────────────────────────────────────────
@app.post("/api/dtc/lookup")
def dtc_lookup(req: DtcLookupRequest):
    code = req.code.upper().strip()
    entry = _DTC_DB.get(code)
    if entry:
        return {"code": code, **entry, "color": _SEVERITY_COLOR.get(entry["severity"], "#6B7280")}
    # Generic fallback
    type_map = {"P": "Powertrain", "C": "Chassis", "B": "Body", "U": "Network"}
    system   = type_map.get(code[0], "Unknown") if code else "Unknown"
    return {
        "code":        code,
        "description": f"{system} Fault Code {code}",
        "severity":    "Warning",
        "cause":       "Refer to vehicle service manual",
        "fix":         "Consult a certified mechanic",
        "color":       "#F59E0B",
    }

@app.post("/api/dtc/lookup-batch")
def dtc_lookup_batch(codes: list[str]):
    return [dtc_lookup(DtcLookupRequest(code=c)) for c in codes]

# ── Training data stats ────────────────────────────────────────────────────────
@app.get("/api/training-stats/{user_id}")
def training_stats(user_id: str):
    try:
        db = get_db()
        docs = (
            db.collection("trainingData")
            .where("userId", "==", user_id)
            .stream()
        )
        records = [d.to_dict() for d in docs]
        total   = len(records)
        by_label = {"Normal": 0, "Warning": 0, "Critical": 0}
        for r in records:
            lbl = r.get("label", "Normal")
            by_label[lbl] = by_label.get(lbl, 0) + 1

        avg_rpm = sum(r.get("avg_rpm", 0) for r in records) / total if total else 0
        avg_load = sum(r.get("avg_engineLoad", 0) for r in records) / total if total else 0

        return {
            "userId":    user_id,
            "total":     total,
            "byLabel":   by_label,
            "readyToTrain": total >= 5,
            "averages": {
                "rpm":        round(avg_rpm, 1),
                "engineLoad": round(avg_load, 1),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Training data list ─────────────────────────────────────────────────────────
@app.get("/api/training-data/{user_id}")
def get_training_data(user_id: str, limit: int = Query(default=50, le=200)):
    try:
        db = get_db()
        docs = (
            db.collection("trainingData")
            .where("userId", "==", user_id)
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        records = []
        for d in docs:
            rec = d.to_dict()
            rec["id"] = d.id
            # Firestore timestamps → ISO strings
            if hasattr(rec.get("createdAt"), "isoformat"):
                rec["createdAt"] = rec["createdAt"].isoformat()
            # Drop raw snapshots from API response (too large)
            rec.pop("rawSnapshots", None)
            records.append(rec)
        return {"userId": user_id, "count": len(records), "records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Save training record ───────────────────────────────────────────────────────
@app.post("/api/training-data", status_code=201)
def save_training_record(record: TrainingRecord):
    allowed_labels = {"Normal", "Warning", "Critical"}
    if record.label not in allowed_labels:
        raise HTTPException(status_code=400, detail=f"label must be one of {allowed_labels}")
    try:
        db = get_db()
        ref = db.collection("trainingData").add({
            **record.dict(),
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        return {"id": ref[1].id, "status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Simple rule-based server-side prediction (fallback when device model absent) ─
@app.post("/api/predict")
def predict_server(req: PredictRequest):
    """
    Rule-based engine health classification.
    Used as a fallback when the on-device TF.js model is not yet trained.
    """
    score  = 100
    issues = []

    if req.coolantTemp > 105:
        score -= 30; issues.append("Coolant temp critically high")
    elif req.coolantTemp > 100:
        score -= 15; issues.append("Coolant temp elevated")

    if req.voltage < 11.5:
        score -= 25; issues.append("Battery voltage critically low")
    elif req.voltage < 12.0:
        score -= 10; issues.append("Battery voltage low")

    if req.engineLoad > 85:
        score -= 10; issues.append("Engine load very high")

    if req.rpm > 5500:
        score -= 15; issues.append("RPM spike detected")
    elif req.rpm > 5000:
        score -= 5;  issues.append("High RPM")

    score = max(0, score)

    if score >= 80:
        label, confidence = "Normal",   min(100, score)
    elif score >= 55:
        label, confidence = "Warning",  min(100, 100 - score + 55)
    else:
        label, confidence = "Critical", min(100, 100 - score)

    return {
        "label":      label,
        "confidence": confidence,
        "score":      score,
        "issues":     issues,
        "method":     "rule-based",
    }

# ── Delete training record ─────────────────────────────────────────────────────
@app.delete("/api/training-data/{doc_id}")
def delete_training_record(doc_id: str, user_id: str = Query(...)):
    try:
        db  = get_db()
        ref = db.collection("trainingData").document(doc_id)
        doc = ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Record not found")
        if doc.to_dict().get("userId") != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")
        ref.delete()
        return {"status": "deleted", "id": doc_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
