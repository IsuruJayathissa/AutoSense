// Lazy-loaded so the native module is only resolved when Export is tapped,
// not at app startup (avoids "Cannot find native module 'ExpoPrint'" crash).
let Print   = null;
let Sharing = null;

async function loadPrintModules() {
  try {
    if (!Print)   Print   = require('expo-print');
    if (!Sharing) Sharing = require('expo-sharing');
  } catch (e) {
    throw new Error(
      'PDF export requires a native build.\nRun: npx expo run:android\n\n(' + e.message + ')'
    );
  }
}

const SEVERITY_COLOR = { Critical: '#DC2626', Warning: '#F59E0B', Info: '#10B981', Normal: '#10B981' };
const LABEL_COLOR    = { Critical: '#DC2626', Warning: '#F59E0B', Normal: '#10B981' };

class ReportService {

  // ── Build the HTML report ──────────────────────────────────────────────────
  generateHTML({ vehicle, sensorData, faultCodes = [], healthScore, prediction, sessions = [], timestamp }) {
    const dateStr = timestamp
      ? new Date(timestamp).toLocaleString()
      : new Date().toLocaleString();

    const vehicleName = vehicle
      ? `${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.year || '—'})`
      : 'Unknown Vehicle';

    const predColor = prediction ? (LABEL_COLOR[prediction.label] || '#6B7280') : '#6B7280';

    // Fault codes table rows
    const dtcRows = faultCodes.length
      ? faultCodes.map(f => `
          <tr>
            <td><b>${f.code}</b></td>
            <td>${f.description}</td>
            <td style="color:${SEVERITY_COLOR[f.severity] || '#6B7280'}">${f.severity}</td>
            <td>${f.cause}</td>
            <td>${f.fix}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#10B981">✅ No fault codes detected</td></tr>`;

    // Training sessions rows
    const sessionRows = sessions.length
      ? sessions.map(s => {
          const d = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : '—';
          const lc = LABEL_COLOR[s.label] || '#6B7280';
          return `
            <tr>
              <td>${d}</td>
              <td style="color:${lc};font-weight:700">${s.label}</td>
              <td>${s.avg_rpm?.toFixed(0) || '—'}</td>
              <td>${s.avg_coolantTemp?.toFixed(1) || '—'}°C</td>
              <td>${s.avg_engineLoad?.toFixed(1) || '—'}%</td>
              <td>${s.avg_voltage?.toFixed(1) || '—'}V</td>
              <td>${s.snapshotCount || '—'}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="7" style="text-align:center;color:#9CA3AF">No training sessions recorded</td></tr>`;

    // Health score bar
    const hScore = healthScore ?? 100;
    const hColor = hScore >= 80 ? '#10B981' : hScore >= 60 ? '#F59E0B' : '#DC2626';
    const hLabel = hScore >= 80 ? 'Excellent' : hScore >= 60 ? 'Warning' : 'Critical';

    // Live sensor rows
    const sensor = sensorData || {};
    const sensorRows = [
      ['Engine RPM',          sensor.rpm,          ''],
      ['Vehicle Speed',       sensor.speed,        ' km/h'],
      ['Coolant Temperature', sensor.coolantTemp,  '°C'],
      ['Engine Load',         sensor.engineLoad,   '%'],
      ['Throttle Position',   sensor.throttle,     '%'],
      ['Battery Voltage',     sensor.voltage,      'V'],
      ['Fuel Level',          sensor.fuelLevel,    '%'],
      ['Intake Air Temp',     sensor.intakeTemp,   '°C'],
      ['MAF Airflow',         sensor.maf,          ' g/s'],
      ['Ignition Timing',     sensor.timing,       '°'],
    ].filter(([, v]) => v != null && v !== 0 && !isNaN(v))
     .map(([label, value, unit]) => `
        <tr>
          <td>${label}</td>
          <td><b>${typeof value === 'number' ? value.toFixed(typeof value === 'number' && value % 1 !== 0 ? 1 : 0) : value}${unit}</b></td>
        </tr>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>AutoSense Diagnostic Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; color: #1F2937; background: #fff; padding: 24px; }
    .header { background: linear-gradient(135deg, #8B0000, #A00000); color: #fff; padding: 28px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; }
    .header p  { font-size: 13px; opacity: 0.85; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    h2 { font-size: 16px; font-weight: 700; color: #1F2937; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #8B0000; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    th { background: #F3F4F6; color: #374151; padding: 8px 10px; text-align: left; font-weight: 700; }
    td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
    .score-bar-bg { background: #E5E7EB; border-radius: 4px; height: 14px; margin: 10px 0 4px; overflow: hidden; }
    .score-bar    { height: 14px; border-radius: 4px; }
    .score-label  { font-size: 32px; font-weight: 800; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .meta-item { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 120px; }
    .meta-item .val { font-size: 18px; font-weight: 700; }
    .meta-item .lbl { font-size: 10px; color: #9CA3AF; margin-top: 2px; }
    .prediction-box { border: 2px solid ${predColor}; border-radius: 10px; padding: 14px; margin-bottom: 16px; background: ${predColor}10; }
    .prob-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 12px; }
    .prob-bar-bg { flex: 1; background: #E5E7EB; border-radius: 3px; height: 8px; overflow: hidden; }
    .footer { margin-top: 32px; font-size: 10px; color: #9CA3AF; text-align: center; padding-top: 12px; border-top: 1px solid #E5E7EB; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <h1>Auto<span style="opacity:0.7">Sense</span> Diagnostic Report</h1>
    <p>${vehicleName} &nbsp;•&nbsp; Generated: ${dateStr}</p>
    <p style="margin-top:6px">Vehicle No: ${vehicle?.vehicleNumber || '—'} &nbsp;|&nbsp; Engine: ${vehicle?.engineType || '—'}</p>
  </div>

  <!-- Health Score -->
  <h2>Engine Health Score</h2>
  <div class="meta">
    <div class="meta-item">
      <div class="val" style="color:${hColor}">${hScore}</div>
      <div class="lbl">Health Score / 100</div>
    </div>
    <div class="meta-item">
      <div class="val" style="color:${hColor}">${hLabel}</div>
      <div class="lbl">Overall Status</div>
    </div>
    <div class="meta-item">
      <div class="val">${faultCodes.length}</div>
      <div class="lbl">Fault Codes</div>
    </div>
    <div class="meta-item">
      <div class="val">${sessions.length}</div>
      <div class="lbl">Training Sessions</div>
    </div>
  </div>
  <div class="score-bar-bg">
    <div class="score-bar" style="width:${hScore}%;background:${hColor}"></div>
  </div>
  <p style="font-size:11px;color:#9CA3AF">0 — Critical &nbsp;&nbsp;&nbsp; 100 — Excellent</p>

  <!-- AI Prediction -->
  ${prediction ? `
  <h2>AI Diagnosis</h2>
  <div class="prediction-box">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span class="score-label" style="color:${predColor}">${prediction.label}</span>
      <span style="color:#6B7280;font-size:12px">${prediction.confidence}% confidence</span>
    </div>
    <div class="prob-row"><span style="width:60px">Normal</span><div class="prob-bar-bg"><div class="score-bar" style="width:${prediction.probabilities?.Normal || 0}%;background:#10B981"></div></div><b style="color:#10B981">${prediction.probabilities?.Normal || 0}%</b></div>
    <div class="prob-row"><span style="width:60px">Warning</span><div class="prob-bar-bg"><div class="score-bar" style="width:${prediction.probabilities?.Warning || 0}%;background:#F59E0B"></div></div><b style="color:#F59E0B">${prediction.probabilities?.Warning || 0}%</b></div>
    <div class="prob-row"><span style="width:60px">Critical</span><div class="prob-bar-bg"><div class="score-bar" style="width:${prediction.probabilities?.Critical || 0}%;background:#DC2626"></div></div><b style="color:#DC2626">${prediction.probabilities?.Critical || 0}%</b></div>
  </div>` : ''}

  <!-- Live Sensor Data -->
  ${sensorRows ? `
  <h2>Live Sensor Snapshot</h2>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>${sensorRows}</tbody>
  </table>` : ''}

  <!-- Fault Codes -->
  <h2>Diagnostic Trouble Codes (DTC)</h2>
  <table>
    <thead><tr><th>Code</th><th>Description</th><th>Severity</th><th>Cause</th><th>Recommended Fix</th></tr></thead>
    <tbody>${dtcRows}</tbody>
  </table>

  <!-- Training Sessions -->
  <h2>Recorded OBD Sessions</h2>
  <table>
    <thead><tr><th>Date / Time</th><th>Label</th><th>Avg RPM</th><th>Avg Coolant</th><th>Avg Load</th><th>Avg Voltage</th><th>Snapshots</th></tr></thead>
    <tbody>${sessionRows}</tbody>
  </table>

  <div class="footer">
    AutoSense Smart Vehicle Diagnostic &nbsp;•&nbsp; Report generated automatically on ${dateStr}
  </div>

</body>
</html>`;
  }

  // ── Print to PDF and share ─────────────────────────────────────────────────
  async exportPDF(data) {
    await loadPrintModules();
    const html = this.generateHTML(data);
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share AutoSense Diagnostic Report',
        UTI: 'com.adobe.pdf',
      });
    }
    return uri;
  }
}

export default new ReportService();
