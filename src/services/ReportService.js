import { Linking, Share, Alert } from 'react-native';
import {
  INSPECTION_SECTIONS,
  ECU_REPORT_FIELDS,
  summarizeResults,
  STATUS_META,
} from '../data/inspectionChecklist';

// ── Native module loaders ─────────────────────────────────────────────────────
// Each module is wrapped in its own try/catch so that a missing native module
// (e.g. running in Expo Go without a custom dev build) degrades gracefully
// instead of crashing the report flow.
let Print      = null;
let Sharing    = null;
let FileSystem = null;
let printAttempted = false;
let sharingAttempted = false;
let fsAttempted = false;

function tryLoadPrint() {
  if (Print || printAttempted) return Print;
  printAttempted = true;
  try { Print = require('expo-print'); } catch { Print = null; }
  return Print;
}
function tryLoadSharing() {
  if (Sharing || sharingAttempted) return Sharing;
  sharingAttempted = true;
  try { Sharing = require('expo-sharing'); } catch { Sharing = null; }
  return Sharing;
}
// expo-file-system v19 (SDK 54) split the API:
//   - main entry  → new File / Paths class API
//   - /legacy     → old cacheDirectory + writeAsStringAsync API
// We try the legacy entry first (simpler to use), then fall back to the new
// API on the main entry, then null if neither is available.
function tryLoadFileSystem() {
  if (FileSystem || fsAttempted) return FileSystem;
  fsAttempted = true;
  try {
    FileSystem = require('expo-file-system/legacy');
    if (FileSystem && FileSystem.cacheDirectory) return FileSystem;
  } catch {}
  try {
    FileSystem = require('expo-file-system');
  } catch {
    FileSystem = null;
  }
  return FileSystem;
}

// Write `html` to a file and return { uri, mimeType, isPdf }.
// Tries (in order): expo-print PDF → legacy file-system API → new file-system API.
async function writeReportFile(html, baseName) {
  // 1. PDF via expo-print (only available in a custom dev build)
  const print = tryLoadPrint();
  if (print && typeof print.printToFileAsync === 'function') {
    try {
      const { uri } = await print.printToFileAsync({ html, base64: false });
      return { uri, mimeType: 'application/pdf', isPdf: true };
    } catch {
      // fall through to HTML
    }
  }

  const fs = tryLoadFileSystem();
  const fileName = `${baseName}-${Date.now()}.html`;

  // 2. Legacy file-system API: cacheDirectory + writeAsStringAsync
  if (fs && fs.cacheDirectory && typeof fs.writeAsStringAsync === 'function') {
    const uri = `${fs.cacheDirectory}${fileName}`;
    await fs.writeAsStringAsync(uri, html, {
      encoding: fs.EncodingType?.UTF8 || 'utf8',
    });
    return { uri, mimeType: 'text/html', isPdf: false };
  }

  // 3. New file-system API: File + Paths classes
  if (fs && fs.File && fs.Paths) {
    try {
      const file = new fs.File(fs.Paths.cache, fileName);
      if (typeof file.create === 'function') file.create();
      if (typeof file.write === 'function') {
        file.write(html);
      } else if (typeof file.writeText === 'function') {
        file.writeText(html);
      } else {
        throw new Error('File API has no write method');
      }
      return { uri: file.uri, mimeType: 'text/html', isPdf: false };
    } catch (e) {
      throw new Error(
        'Failed to write report file via new expo-file-system API: ' + e.message
      );
    }
  }

  throw new Error(
    'Cannot save the report — no compatible file-system API is available. ' +
    'Build a development client with: npx expo run:android'
  );
}

// Share a saved file using the best available channel.
// Falls back to React Native's built-in Share API if expo-sharing isn't loaded.
async function shareFile(uri, { dialogTitle, mimeType, fallbackMessage } = {}) {
  const sharing = tryLoadSharing();
  if (sharing && typeof sharing.isAvailableAsync === 'function') {
    try {
      const ok = await sharing.isAvailableAsync();
      if (ok) {
        await sharing.shareAsync(uri, {
          mimeType: mimeType || 'application/pdf',
          dialogTitle: dialogTitle || 'Share Report',
          UTI: mimeType === 'text/html' ? 'public.html' : 'com.adobe.pdf',
        });
        return true;
      }
    } catch (e) {
      // fall through to RN Share fallback
    }
  }

  // Fallback for Expo Go: text-only share. The actual file stays on the device
  // at `uri` and the user is told where to find it.
  await Share.share({
    title: dialogTitle || 'Vehicle Report',
    message: (fallbackMessage || 'Vehicle Inspection Report') +
             (uri ? `\n\nReport saved to:\n${uri}` : ''),
  });
  return false;
}

const SEVERITY_COLOR = { Critical: '#DC2626', Warning: '#F59E0B', Info: '#10B981', Normal: '#10B981' };
const LABEL_COLOR    = { Critical: '#DC2626', Warning: '#F59E0B', Normal: '#10B981' };

// Escape user-provided strings before injecting into HTML.
function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class ReportService {

  // ── Diagnostic report (existing) ───────────────────────────────────────────
  generateHTML({ vehicle, sensorData, faultCodes = [], healthScore, prediction, sessions = [], timestamp }) {
    const dateStr = timestamp
      ? new Date(timestamp).toLocaleString()
      : new Date().toLocaleString();

    const vehicleName = vehicle
      ? `${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.year || '—'})`
      : 'Unknown Vehicle';

    const predColor = prediction ? (LABEL_COLOR[prediction.label] || '#6B7280') : '#6B7280';

    const dtcRows = faultCodes.length
      ? faultCodes.map(f => `
          <tr>
            <td><b>${esc(f.code)}</b></td>
            <td>${esc(f.description)}</td>
            <td style="color:${SEVERITY_COLOR[f.severity] || '#6B7280'}">${esc(f.severity)}</td>
            <td>${esc(f.cause)}</td>
            <td>${esc(f.fix)}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#10B981">✅ No fault codes detected</td></tr>`;

    const sessionRows = sessions.length
      ? sessions.map(s => {
          const d = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : '—';
          const lc = LABEL_COLOR[s.label] || '#6B7280';
          return `
            <tr>
              <td>${d}</td>
              <td style="color:${lc};font-weight:700">${esc(s.label)}</td>
              <td>${s.avg_rpm?.toFixed(0) || '—'}</td>
              <td>${s.avg_coolantTemp?.toFixed(1) || '—'}°C</td>
              <td>${s.avg_engineLoad?.toFixed(1) || '—'}%</td>
              <td>${s.avg_voltage?.toFixed(1) || '—'}V</td>
              <td>${s.snapshotCount || '—'}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="7" style="text-align:center;color:#9CA3AF">No training sessions recorded</td></tr>`;

    const hScore = healthScore ?? 100;
    const hColor = hScore >= 80 ? '#10B981' : hScore >= 60 ? '#F59E0B' : '#DC2626';
    const hLabel = hScore >= 80 ? 'Excellent' : hScore >= 60 ? 'Warning' : 'Critical';

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

  <div class="header">
    <h1>Auto<span style="opacity:0.7">Sense</span> Diagnostic Report</h1>
    <p>${esc(vehicleName)} &nbsp;•&nbsp; Generated: ${dateStr}</p>
    <p style="margin-top:6px">Vehicle No: ${esc(vehicle?.vehicleNumber || '—')} &nbsp;|&nbsp; Engine: ${esc(vehicle?.engineType || '—')}</p>
  </div>

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

  ${prediction ? `
  <h2>AI Diagnosis</h2>
  <div class="prediction-box">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span class="score-label" style="color:${predColor}">${esc(prediction.label)}</span>
      <span style="color:#6B7280;font-size:12px">${prediction.confidence}% confidence</span>
    </div>
    <div class="prob-row"><span style="width:60px">Normal</span><div class="prob-bar-bg"><div class="score-bar" style="width:${prediction.probabilities?.Normal || 0}%;background:#10B981"></div></div><b style="color:#10B981">${prediction.probabilities?.Normal || 0}%</b></div>
    <div class="prob-row"><span style="width:60px">Warning</span><div class="prob-bar-bg"><div class="score-bar" style="width:${prediction.probabilities?.Warning || 0}%;background:#F59E0B"></div></div><b style="color:#F59E0B">${prediction.probabilities?.Warning || 0}%</b></div>
    <div class="prob-row"><span style="width:60px">Critical</span><div class="prob-bar-bg"><div class="score-bar" style="width:${prediction.probabilities?.Critical || 0}%;background:#DC2626"></div></div><b style="color:#DC2626">${prediction.probabilities?.Critical || 0}%</b></div>
  </div>` : ''}

  ${sensorRows ? `
  <h2>Live Sensor Snapshot</h2>
  <table>
    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>${sensorRows}</tbody>
  </table>` : ''}

  <h2>Diagnostic Trouble Codes (DTC)</h2>
  <table>
    <thead><tr><th>Code</th><th>Description</th><th>Severity</th><th>Cause</th><th>Recommended Fix</th></tr></thead>
    <tbody>${dtcRows}</tbody>
  </table>

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

  async exportPDF(data) {
    const html = this.generateHTML(data);
    const { uri, mimeType } = await writeReportFile(html, 'autosense-report');
    await shareFile(uri, {
      mimeType,
      dialogTitle: 'Share AutoSense Diagnostic Report',
      fallbackMessage: 'AutoSense Diagnostic Report',
    });
    return uri;
  }

  // ── Inspection Report ──────────────────────────────────────────────────────
  generateInspectionHTML({
    vehicle,
    inspectorName,
    odometer,
    results = {},
    ecuSnapshot,
    healthScore,
    faultCodes = [],
    notes,
    timestamp,
  }) {
    const dateStr = timestamp
      ? new Date(timestamp).toLocaleString()
      : new Date().toLocaleString();

    const vehicleName = vehicle
      ? `${vehicle.brand || ''} ${vehicle.model || ''} (${vehicle.year || '—'})`
      : 'Unknown Vehicle';

    const summary = summarizeResults(results);

    // Each section as a labelled card with traffic-light items
    const sectionsHtml = INSPECTION_SECTIONS.map((section) => {
      const itemsHtml = section.items.map((item) => {
        const r = results[item.id] || { status: 'na', notes: '' };
        const meta = STATUS_META[r.status] || STATUS_META.na;
        const noteCell = r.notes
          ? `<div class="item-note">📝 ${esc(r.notes)}</div>`
          : '';
        return `
          <div class="ins-item">
            <div class="ins-item-row">
              <span class="ins-item-label">${esc(item.label)}</span>
              <span class="ins-pill" style="background:${meta.color}20;color:${meta.color};border-color:${meta.color}">
                <span class="ins-pill-dot" style="background:${meta.color}"></span>
                ${esc(meta.label)}
              </span>
            </div>
            ${noteCell}
          </div>`;
      }).join('');

      return `
        <h2>${esc(section.title)}</h2>
        <div class="ins-section">${itemsHtml}</div>`;
    }).join('');

    // ECU rows from snapshot
    let ecuRowsHtml = '';
    if (ecuSnapshot) {
      ecuRowsHtml = ECU_REPORT_FIELDS
        .map((f) => {
          const v = ecuSnapshot[f.id];
          if (v == null || isNaN(v)) return null;
          const display = typeof v === 'number'
            ? (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1))
            : v;
          return `<tr><td>${esc(f.label)}</td><td><b>${display}${esc(f.unit)}</b></td></tr>`;
        })
        .filter(Boolean)
        .join('');
    }

    // DTC rows
    const dtcRowsHtml = faultCodes.length
      ? faultCodes.map((f) => `
          <tr>
            <td><b>${esc(f.code)}</b></td>
            <td>${esc(f.description)}</td>
            <td style="color:${SEVERITY_COLOR[f.severity] || '#6B7280'}">${esc(f.severity)}</td>
            <td>${esc(f.cause)}</td>
            <td>${esc(f.fix)}</td>
          </tr>`).join('')
      : `<tr><td colspan="5" style="text-align:center;color:#10B981">✅ No fault codes detected</td></tr>`;

    const hScore = healthScore != null ? healthScore : null;
    const hColor = hScore == null ? '#9CA3AF'
      : hScore >= 80 ? '#10B981'
      : hScore >= 60 ? '#F59E0B'
      : '#DC2626';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Vehicle Inspection Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; color: #1F2937; background: #fff; padding: 24px; }

    .ins-header {
      border: 2px solid #1F2937; border-radius: 10px;
      padding: 22px; margin-bottom: 22px;
    }
    .ins-header h1 {
      font-size: 22px; font-weight: 800; color: #1F2937;
      letter-spacing: 0.5px; margin-bottom: 4px;
    }
    .ins-header h1 .accent { color: #8B0000; }
    .ins-header .subtitle { font-size: 12px; color: #6B7280; margin-bottom: 14px; }

    .ins-meta-grid {
      display: grid; grid-template-columns: repeat(2, 1fr);
      gap: 6px 24px; font-size: 12px;
    }
    .ins-meta-grid div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #E5E7EB; }
    .ins-meta-grid .lbl { color: #6B7280; font-weight: 500; }
    .ins-meta-grid .val { color: #1F2937; font-weight: 700; }

    h2 { font-size: 14px; font-weight: 700; color: #1F2937; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #8B0000; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Summary band */
    .summary-band {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 10px; margin-bottom: 18px;
    }
    .summary-tile {
      border-radius: 8px; padding: 12px; text-align: center;
      border: 1px solid #E5E7EB;
    }
    .summary-tile .num { font-size: 22px; font-weight: 800; }
    .summary-tile .lbl { font-size: 10px; color: #6B7280; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.4px; }
    .tile-green  { background: #ECFDF5; }
    .tile-green  .num { color: #10B981; }
    .tile-yellow { background: #FFFBEB; }
    .tile-yellow .num { color: #F59E0B; }
    .tile-red    { background: #FEF2F2; }
    .tile-red    .num { color: #DC2626; }
    .tile-na     { background: #F9FAFB; }
    .tile-na     .num { color: #6B7280; }

    /* Inspection items */
    .ins-section { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
    .ins-item { padding: 10px 14px; border-bottom: 1px solid #F3F4F6; }
    .ins-item:last-child { border-bottom: none; }
    .ins-item-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .ins-item-label { font-size: 12px; color: #1F2937; flex: 1; }
    .ins-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 12px; border: 1px solid;
      font-size: 10px; font-weight: 700;
      white-space: nowrap;
    }
    .ins-pill-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
    .item-note { font-size: 11px; color: #6B7280; margin-top: 4px; padding-left: 4px; font-style: italic; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    th { background: #F3F4F6; color: #374151; padding: 8px 10px; text-align: left; font-weight: 700; }
    td { padding: 8px 10px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }

    /* Health score bar */
    .health-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .health-num { font-size: 28px; font-weight: 800; color: ${hColor}; }
    .health-bar-bg { flex: 1; background: #E5E7EB; border-radius: 4px; height: 12px; overflow: hidden; }
    .health-bar { height: 12px; border-radius: 4px; background: ${hColor}; }

    .general-notes {
      background: #FFFBEB; border-left: 4px solid #F59E0B;
      padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #1F2937;
    }

    .footer {
      margin-top: 28px; font-size: 10px; color: #9CA3AF;
      text-align: center; padding-top: 12px; border-top: 1px solid #E5E7EB;
    }
    .legend { display: flex; gap: 16px; justify-content: center; margin-top: 8px; font-size: 10px; }
    .legend span { display: inline-flex; align-items: center; gap: 4px; }
    .legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="ins-header">
    <h1>Vehicle <span class="accent">Inspection</span> Report</h1>
    <div class="subtitle">Multi-Point Inspection &nbsp;•&nbsp; Generated by AutoSense</div>

    <div class="ins-meta-grid">
      <div><span class="lbl">Vehicle</span><span class="val">${esc(vehicleName)}</span></div>
      <div><span class="lbl">Vehicle Number</span><span class="val">${esc(vehicle?.vehicleNumber || '—')}</span></div>
      <div><span class="lbl">Engine Type</span><span class="val">${esc(vehicle?.engineType || '—')}</span></div>
      <div><span class="lbl">Odometer</span><span class="val">${esc(odometer || '—')}${odometer ? ' km' : ''}</span></div>
      <div><span class="lbl">Inspector</span><span class="val">${esc(inspectorName || '—')}</span></div>
      <div><span class="lbl">Date</span><span class="val">${esc(dateStr)}</span></div>
    </div>
  </div>

  <!-- Summary -->
  <h2>Inspection Summary</h2>
  <div class="summary-band">
    <div class="summary-tile tile-green"><div class="num">${summary.green}</div><div class="lbl">Good</div></div>
    <div class="summary-tile tile-yellow"><div class="num">${summary.yellow}</div><div class="lbl">Monitor</div></div>
    <div class="summary-tile tile-red"><div class="num">${summary.red}</div><div class="lbl">Action Needed</div></div>
    <div class="summary-tile tile-na"><div class="num">${summary.na}</div><div class="lbl">Not Inspected</div></div>
  </div>

  <!-- Inspection sections -->
  ${sectionsHtml}

  <!-- ECU section -->
  <h2>ECU Diagnostics — Live Snapshot</h2>
  ${ecuSnapshot ? `
    ${hScore != null ? `
      <div class="health-row">
        <div>
          <div class="health-num">${hScore}</div>
          <div style="font-size:10px;color:#6B7280;letter-spacing:0.4px">ENGINE HEALTH SCORE / 100</div>
        </div>
        <div class="health-bar-bg"><div class="health-bar" style="width:${hScore}%"></div></div>
      </div>` : ''}
    ${ecuRowsHtml ? `
      <table>
        <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
        <tbody>${ecuRowsHtml}</tbody>
      </table>` : '<p style="font-size:12px;color:#9CA3AF">No sensor values returned by the ECU.</p>'}
  ` : '<p style="font-size:12px;color:#9CA3AF">No ECU snapshot was captured during this inspection.</p>'}

  <!-- DTCs -->
  <h2>Diagnostic Trouble Codes</h2>
  <table>
    <thead><tr><th>Code</th><th>Description</th><th>Severity</th><th>Cause</th><th>Recommended Fix</th></tr></thead>
    <tbody>${dtcRowsHtml}</tbody>
  </table>

  ${notes ? `
    <h2>General Notes</h2>
    <div class="general-notes">${esc(notes)}</div>` : ''}

  <div class="footer">
    AutoSense Vehicle Inspection &nbsp;•&nbsp; ${dateStr}
    <div class="legend">
      <span><span class="dot" style="background:#10B981"></span> Good</span>
      <span><span class="dot" style="background:#F59E0B"></span> Monitor</span>
      <span><span class="dot" style="background:#DC2626"></span> Action Needed</span>
      <span><span class="dot" style="background:#9CA3AF"></span> Not Inspected</span>
    </div>
  </div>

</body>
</html>`;
  }

  async exportInspectionPDF(data) {
    const html = this.generateInspectionHTML(data);
    const { uri, mimeType } = await writeReportFile(html, 'inspection');

    if (data.skipShare) return uri;

    const vehicleLine = data?.vehicle
      ? `${data.vehicle.brand || ''} ${data.vehicle.model || ''} ${data.vehicle.vehicleNumber ? '(' + data.vehicle.vehicleNumber + ')' : ''}`.trim()
      : '';

    await shareFile(uri, {
      mimeType,
      dialogTitle: 'Share Vehicle Inspection Report',
      fallbackMessage: `Vehicle Inspection Report${vehicleLine ? ' — ' + vehicleLine : ''}`,
    });
    return uri;
  }

  // ── WhatsApp share ─────────────────────────────────────────────────────────
  // WhatsApp on Android can't accept a file via deep-link directly without a
  // FileProvider content URI, which Expo doesn't expose cleanly. The most
  // reliable strategy is:
  //   1. If expo-sharing is available, open the system share sheet with the
  //      file attached — WhatsApp shows up as a prominent option for PDFs/HTML.
  //   2. Otherwise, open WhatsApp directly with a text-only deep link so at
  //      least the conversation is started; user has to attach the saved file
  //      from their downloads / cache themselves.
  async shareToWhatsApp(uri, vehicle) {
    const vehicleLine = vehicle
      ? `${vehicle.brand || ''} ${vehicle.model || ''} ${vehicle.vehicleNumber ? '(' + vehicle.vehicleNumber + ')' : ''}`.trim()
      : '';

    const sharing = tryLoadSharing();
    if (sharing && typeof sharing.isAvailableAsync === 'function' && uri) {
      try {
        const ok = await sharing.isAvailableAsync();
        if (ok) {
          // Best guess at MIME from the file extension
          const isHtml = uri.toLowerCase().endsWith('.html');
          await sharing.shareAsync(uri, {
            mimeType: isHtml ? 'text/html' : 'application/pdf',
            dialogTitle: 'Send Inspection Report via WhatsApp',
            UTI: isHtml ? 'public.html' : 'com.adobe.pdf',
          });
          return;
        }
      } catch (e) {
        // Fall through to deep link
      }
    }

    // Fallback: WhatsApp text-only deep link
    const msg = `AutoSense Vehicle Inspection Report${vehicleLine ? ' — ' + vehicleLine : ''}` +
                (uri ? `\n\nReport file: ${uri}` : '');
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      throw new Error('WhatsApp is not installed on this device.');
    }
    Alert.alert(
      'Sharing via WhatsApp',
      'WhatsApp will open with a text message. The report file has been saved to your device — you can attach it manually from WhatsApp.',
      [{ text: 'OK', onPress: () => Linking.openURL(url) }]
    );
  }
}

export default new ReportService();
