import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

// Base64 helpers
const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function toBase64(str) {
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i);
    const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    output += base64Chars[(a >> 2) & 0x3f];
    output += base64Chars[((a << 4) | (b >> 4)) & 0x3f];
    output += i + 1 < str.length ? base64Chars[((b << 2) | (c >> 6)) & 0x3f] : '=';
    output += i + 2 < str.length ? base64Chars[c & 0x3f] : '=';
  }
  return output;
}

function fromBase64(str) {
  let output = '';
  const cleaned = str.replace(/[^A-Za-z0-9+/=]/g, '');
  for (let i = 0; i < cleaned.length; i += 4) {
    const a = base64Chars.indexOf(cleaned[i]);
    const b = base64Chars.indexOf(cleaned[i + 1]);
    const c = base64Chars.indexOf(cleaned[i + 2]);
    const d = base64Chars.indexOf(cleaned[i + 3]);
    output += String.fromCharCode((a << 2) | (b >> 4));
    if (c !== 64) output += String.fromCharCode(((b & 15) << 4) | (c >> 2));
    if (d !== 64) output += String.fromCharCode(((c & 3) << 6) | d);
  }
  return output;
}

const ELM327_SERVICE_UUIDS = [
  'fff0',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

// ─────────────────────────────────────────────────────────────────────────────
//  AT Commands
// ─────────────────────────────────────────────────────────────────────────────
const AT_COMMANDS = {
  RESET:           'ATZ\r',
  ECHO_OFF:        'ATE0\r',
  LINEFEED_OFF:    'ATL0\r',
  HEADERS_OFF:     'ATH0\r',
  SPACES_OFF:      'ATS0\r',
  AUTO_PROTOCOL:   'ATSP0\r',
  ADAPTIVE_TIMING: 'ATAT1\r',
  TIMEOUT:         'ATST32\r',
};

// ─────────────────────────────────────────────────────────────────────────────
//  OBD-II PID Commands — original + all new sensors
// ─────────────────────────────────────────────────────────────────────────────
const COMMANDS = {
  // ── Original sensors ──────────────────────────────────────────────────────
  RPM:                '010C\r',
  SPEED:              '010D\r',
  COOLANT_TEMP:       '0105\r',
  THROTTLE:           '0111\r',
  FUEL_LEVEL:         '012F\r',
  ENGINE_LOAD:        '0104\r',
  CONTROL_VOLTAGE:    '0142\r',
  INTAKE_TEMP:        '010F\r',
  MAF:                '0110\r',
  TIMING_ADVANCE:     '010E\r',
  FUEL_PRESSURE:      '010A\r',
  SHORT_FUEL_TRIM:    '0106\r',
  BAROMETRIC:         '0133\r',
  OIL_TEMP:           '015C\r',

  // ── NEW: Fuel system ──────────────────────────────────────────────────────
  LONG_FUEL_TRIM_1:   '0107\r', // Long term fuel trim bank 1 (%)
  SHORT_FUEL_TRIM_2:  '0108\r', // Short term fuel trim bank 2 (%)
  LONG_FUEL_TRIM_2:   '0109\r', // Long term fuel trim bank 2 (%)
  FUEL_RAIL_PRESSURE: '0123\r', // Fuel rail pressure (kPa)
  FUEL_TYPE:          '0151\r', // Fuel type (gasoline/diesel/etc)

  // ── NEW: Oxygen sensors ───────────────────────────────────────────────────
  O2_B1S1_VOLTAGE:    '0114\r', // O2 sensor bank 1 sensor 1 voltage
  O2_B1S2_VOLTAGE:    '0115\r', // O2 sensor bank 1 sensor 2 voltage
  O2_B2S1_VOLTAGE:    '0116\r', // O2 sensor bank 2 sensor 1 voltage
  O2_B2S2_VOLTAGE:    '0117\r', // O2 sensor bank 2 sensor 2 voltage

  // ── NEW: Distance & runtime counters ─────────────────────────────────────
  DISTANCE_MIL_ON:    '0121\r', // Distance travelled with MIL on (km)
  DISTANCE_SINCE_CLR: '0131\r', // Distance since codes cleared (km)
  ENGINE_RUNTIME:     '011F\r', // Engine run time since start (seconds)
  WARMUPS_SINCE_CLR:  '0130\r', // Warm-ups since codes cleared (count)
  RUNTIME_MIL_ON:     '014D\r', // Time run with MIL on (minutes)
  TIME_SINCE_CLR:     '014E\r', // Time since codes cleared (minutes)

  // ── NEW: Ambient & pressure ───────────────────────────────────────────────
  AMBIENT_TEMP:       '0146\r', // Ambient air temperature (°C)
  MAP_PRESSURE:       '010B\r', // Manifold absolute pressure (kPa)
  BOOST_PRESSURE:     '0170\r', // Boost pressure (turbo vehicles only)

  // ── NEW: Advanced engine ──────────────────────────────────────────────────
  EGR_COMMANDED:      '012C\r', // Commanded EGR (%)
  EGR_ERROR:          '012D\r', // EGR error (%)
  EVAP_PURGE:         '012E\r', // Commanded evaporative purge (%)
  CATALYST_TEMP_B1S1: '013C\r', // Catalyst temperature bank 1 sensor 1 (°C)
  THROTTLE_ACTUAL:    '0145\r', // Relative throttle position (%)
  ACCEL_PEDAL_D:      '0149\r', // Accelerator pedal position D (%)
  ACCEL_PEDAL_E:      '014A\r', // Accelerator pedal position E (%)

  // ── NEW: Vehicle identity ─────────────────────────────────────────────────
  VIN:                '0902\r', // Vehicle Identification Number
  ECU_NAME:           '090A\r', // ECU name / description

  // ── DTC commands (unchanged) ──────────────────────────────────────────────
  READ_DTC:           '03\r',
  CLEAR_DTC:          '04\r',
  PENDING_DTC:        '07\r',
};

// ─────────────────────────────────────────────────────────────────────────────
//  PID Response Parser
// ─────────────────────────────────────────────────────────────────────────────
const parseResponse = (pid, rawData) => {
  try {
    if (!rawData) return null;

    const cleaned = rawData
      .replace(/\r/g, '').replace(/\n/g, '').replace(/>/g, '')
      .replace(/\s+/g, '').trim().toUpperCase();

    if (
      cleaned.includes('NODATA') || cleaned.includes('ERROR') ||
      cleaned.includes('UNABLE') || cleaned.includes('STOPPED') ||
      cleaned.includes('SEARCHING') || cleaned.includes('?')
    ) return null;

    // Reject OBD negative response codes (7F xx xx)
    if (cleaned.startsWith('7F')) return null;

    let hexData = cleaned;
    const mode41Index = hexData.indexOf('41');
    if (mode41Index >= 0) hexData = hexData.substring(mode41Index);

    const bytes = hexData.match(/.{1,2}/g);
    if (!bytes || bytes.length < 3) return null;

    const A = parseInt(bytes[2], 16);
    const B = bytes.length > 3 ? parseInt(bytes[3], 16) : 0;
    const C = bytes.length > 4 ? parseInt(bytes[4], 16) : 0;
    const D = bytes.length > 5 ? parseInt(bytes[5], 16) : 0;

    if (isNaN(A)) return null;

    switch (pid) {
      // ── Original ───────────────────────────────────────────────────────────
      case 'RPM':
        return Math.round((A * 256 + B) / 4);
      case 'SPEED':
        return A;
      case 'COOLANT_TEMP':
      case 'INTAKE_TEMP':
      case 'OIL_TEMP':
      case 'AMBIENT_TEMP':
        return A - 40;
      case 'THROTTLE':
      case 'FUEL_LEVEL':
      case 'ENGINE_LOAD':
      case 'THROTTLE_ACTUAL':
      case 'EGR_COMMANDED':
      case 'EVAP_PURGE':
      case 'ACCEL_PEDAL_D':
      case 'ACCEL_PEDAL_E':
        return Math.round((A / 255) * 100);
      case 'CONTROL_VOLTAGE':
        return parseFloat(((A * 256 + B) / 1000).toFixed(1));
      case 'MAF':
        return parseFloat(((A * 256 + B) / 100).toFixed(1));
      case 'TIMING_ADVANCE':
        return Math.round(A / 2 - 64);
      case 'FUEL_PRESSURE':
        return A * 3;
      case 'SHORT_FUEL_TRIM':
      case 'SHORT_FUEL_TRIM_2':
        return parseFloat((A / 1.28 - 100).toFixed(1));
      case 'BAROMETRIC':
      case 'MAP_PRESSURE':
        return A; // kPa

      // ── NEW: Fuel trims ────────────────────────────────────────────────────
      case 'LONG_FUEL_TRIM_1':
      case 'LONG_FUEL_TRIM_2':
        return parseFloat((A / 1.28 - 100).toFixed(1)); // %

      // ── NEW: Fuel rail pressure ────────────────────────────────────────────
      case 'FUEL_RAIL_PRESSURE':
        return (A * 256 + B) * 10; // kPa

      // ── NEW: O2 sensor voltages ────────────────────────────────────────────
      case 'O2_B1S1_VOLTAGE':
      case 'O2_B1S2_VOLTAGE':
      case 'O2_B2S1_VOLTAGE':
      case 'O2_B2S2_VOLTAGE':
        return parseFloat((A / 200).toFixed(3)); // Volts (0–1.275V)

      // ── NEW: Distance counters ─────────────────────────────────────────────
      case 'DISTANCE_MIL_ON':
      case 'DISTANCE_SINCE_CLR':
        return A * 256 + B; // km

      // ── NEW: Runtime counters ──────────────────────────────────────────────
      case 'ENGINE_RUNTIME':
        return A * 256 + B; // seconds

      case 'WARMUPS_SINCE_CLR':
        return A; // count

      case 'RUNTIME_MIL_ON':
      case 'TIME_SINCE_CLR':
        return A * 256 + B; // minutes

      // ── NEW: Catalyst temperature ──────────────────────────────────────────
      case 'CATALYST_TEMP_B1S1':
        return parseFloat(((A * 256 + B) / 10 - 40).toFixed(1)); // °C

      // ── NEW: EGR error ─────────────────────────────────────────────────────
      case 'EGR_ERROR':
        return parseFloat((A / 1.28 - 100).toFixed(1)); // %

      // ── NEW: Boost pressure ────────────────────────────────────────────────
      case 'BOOST_PRESSURE':
        return parseFloat(((A * 256 + B) * 0.03125).toFixed(1)); // kPa

      // ── NEW: Fuel type ─────────────────────────────────────────────────────
      case 'FUEL_TYPE': {
        const fuelTypes = {
          1: 'Gasoline', 2: 'Methanol', 3: 'Ethanol', 4: 'Diesel',
          5: 'LPG', 6: 'CNG', 7: 'Propane', 8: 'Electric',
          9: 'Bifuel Gasoline', 10: 'Bifuel Methanol',
        };
        return fuelTypes[A] || 'Unknown';
      }

      default:
        return null;
    }
  } catch (e) {
    console.warn('OBD Parse Error:', pid, e.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  VIN Parser (multi-frame response)
// ─────────────────────────────────────────────────────────────────────────────
const parseVIN = (rawData) => {
  try {
    if (!rawData) return null;
    const cleaned = rawData.replace(/\s/g, '').replace(/>/g, '').toUpperCase();
    // VIN is 17 ASCII characters encoded in the response
    let hexString = '';
    const hexParts = cleaned.match(/.{2}/g) || [];
    hexParts.forEach(hex => {
      const code = parseInt(hex, 16);
      if (code >= 32 && code <= 126) hexString += String.fromCharCode(code);
    });
    const vinMatch = hexString.match(/[A-HJ-NPR-Z0-9]{17}/);
    return vinMatch ? vinMatch[0] : null;
  } catch (e) {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DTC Parser (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const parseFaultCodes = (rawData) => {
  try {
    if (!rawData) return [];
    const cleaned = rawData
      .replace(/\r/g, '').replace(/\n/g, '').replace(/>/g, '')
      .replace(/\s+/g, '').trim().toUpperCase();
    if (cleaned.includes('NODATA') || cleaned.length < 4) return [];

    let hexData = cleaned;
    const mode43Index = hexData.indexOf('43');
    if (mode43Index >= 0) hexData = hexData.substring(mode43Index + 2);

    const codes = [];
    for (let i = 0; i + 3 < hexData.length; i += 4) {
      const codeHex = hexData.substr(i, 4);
      if (codeHex === '0000') continue;
      const firstByte = parseInt(codeHex.substring(0, 2), 16);
      const secondByte = parseInt(codeHex.substring(2, 4), 16);
      const typeIndex = (firstByte >> 6) & 0x03;
      const types = ['P', 'C', 'B', 'U'];
      const type = types[typeIndex];
      const digit2 = (firstByte >> 4) & 0x03;
      const digit3 = firstByte & 0x0f;
      const digit4 = (secondByte >> 4) & 0x0f;
      const digit5 = secondByte & 0x0f;
      const code = `${type}${digit2}${digit3.toString(16).toUpperCase()}${digit4.toString(16).toUpperCase()}${digit5.toString(16).toUpperCase()}`;
      if (code !== 'P0000') codes.push(code);
    }
    return codes;
  } catch (e) {
    console.warn('DTC Parse Error:', e.message);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  OBDService Class
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  PID Support Bitmask Parser
//  Each of 0100/0120/0140/0160 returns a 4-byte bitmask of which PIDs are
//  supported in that range. Bit 31 of 0100 → PID 01, bit 0 of 0100 → PID 20.
// ─────────────────────────────────────────────────────────────────────────────
const parseSupportedPIDs = (rawData, baseHex) => {
  try {
    if (!rawData) return new Set();
    const cleaned = rawData
      .replace(/\r/g, '').replace(/\n/g, '').replace(/>/g, '')
      .replace(/\s+/g, '').trim().toUpperCase();
    if (cleaned.includes('NODATA') || cleaned.includes('ERROR') ||
        cleaned.includes('UNABLE') || cleaned.startsWith('7F')) return new Set();

    // Response is 41 XX BB BB BB BB where XX is PID 00/20/40/60
    const mode41Index = cleaned.indexOf('41');
    if (mode41Index < 0) return new Set();
    const bytes = cleaned.substring(mode41Index).match(/.{1,2}/g);
    if (!bytes || bytes.length < 6) return new Set();

    // bytes[0]=41 bytes[1]=pidByte bytes[2..5]=bitmask
    const bitmask = (parseInt(bytes[2], 16) << 24) |
                    (parseInt(bytes[3], 16) << 16) |
                    (parseInt(bytes[4], 16) << 8)  |
                     parseInt(bytes[5], 16);

    const base = parseInt(baseHex, 16);
    const supported = new Set();
    for (let i = 0; i < 32; i++) {
      if (bitmask & (1 << (31 - i))) {
        const pid = (base + i + 1).toString(16).toUpperCase().padStart(2, '0');
        supported.add(pid);
      }
    }
    return supported;
  } catch (e) {
    return new Set();
  }
};

const AUTO_RECONNECT_MAX  = 4;
const AUTO_RECONNECT_DELAY = 3000; // ms between attempts
const HEARTBEAT_INTERVAL   = 15000; // ms — sends 0100 ping to confirm link is alive

class OBDService {
  constructor() {
    this.device = null;
    this.serviceUUID = null;
    this.writeCharUUID = null;
    this.notifyCharUUID = null;
    this.isConnected = false;
    this.responseBuffer = '';
    this.responseResolve = null;
    this.commandQueue = [];
    this.isProcessing = false;
    this.connectionListeners = [];
    this.disconnectSubscription = null;
    this.supportedPIDs = new Set();

    // Auto-reconnect state
    this.lastDeviceId = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this.autoReconnect = false;

    // Heartbeat
    this._heartbeatTimer = null;
    this._heartbeatFailed = 0;
  }

  _isPIDSupported(pidHex) {
    if (this.supportedPIDs.size === 0) return true;
    return this.supportedPIDs.has(pidHex.toUpperCase());
  }

  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(cb => cb !== callback);
    };
  }

  _notifyConnectionChange(connected) {
    this.isConnected = connected;
    this.connectionListeners.forEach(cb => cb(connected));
  }

  // ── Auto-reconnect public API ──────────────────────────────────────────────
  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    if (!enabled) this._cancelReconnect();
  }

  // ── Schedule a reconnect attempt after disconnect ──────────────────────────
  _scheduleReconnect() {
    if (!this.autoReconnect || !this.lastDeviceId) return;
    if (this._reconnectAttempts >= AUTO_RECONNECT_MAX) {
      console.log('OBD: Auto-reconnect exhausted after', AUTO_RECONNECT_MAX, 'attempts');
      this._reconnectAttempts = 0;
      // Surface to UI via a special listener value
      this.connectionListeners.forEach(cb => cb(false, 'exhausted'));
      return;
    }

    this._reconnectAttempts++;
    console.log(`OBD: Scheduling reconnect attempt ${this._reconnectAttempts}/${AUTO_RECONNECT_MAX} in ${AUTO_RECONNECT_DELAY}ms`);
    this._reconnectTimer = setTimeout(async () => {
      if (this.isConnected) return; // already reconnected by user
      console.log(`OBD: Auto-reconnect attempt ${this._reconnectAttempts}`);
      try {
        const success = await this.connect(this.lastDeviceId);
        if (success) {
          console.log('OBD: Auto-reconnect succeeded');
          this._reconnectAttempts = 0;
          // notify listeners with a special flag so UI can show a toast
          this.connectionListeners.forEach(cb => cb(true, 'auto'));
        } else {
          this._scheduleReconnect();
        }
      } catch (e) {
        console.warn('OBD: Auto-reconnect error:', e.message);
        this._scheduleReconnect();
      }
    }, AUTO_RECONNECT_DELAY);
  }

  _cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempts = 0;
  }

  // ── Heartbeat: pings the ECU every 15s to detect silent drops ─────────────
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatFailed = 0;
    this._heartbeatTimer = setInterval(async () => {
      if (!this.isConnected) { this._stopHeartbeat(); return; }
      try {
        const r = await this._sendRawCommand('0100\r');
        const ok = r && !r.toUpperCase().includes('ERROR') && !r.toUpperCase().includes('UNABLE');
        if (ok) {
          this._heartbeatFailed = 0;
        } else {
          this._heartbeatFailed++;
          console.warn(`OBD: Heartbeat miss #${this._heartbeatFailed}`);
          if (this._heartbeatFailed >= 2) {
            console.error('OBD: Heartbeat failed twice — treating as disconnected');
            this._stopHeartbeat();
            this._notifyConnectionChange(false);
            this._scheduleReconnect();
          }
        }
      } catch (e) {
        console.warn('OBD: Heartbeat error:', e.message);
      }
    }, HEARTBEAT_INTERVAL);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  async connect(deviceId) {
    this._cancelReconnect(); // clear any pending reconnect before fresh connect
    try {
      this.device = await manager.connectToDevice(deviceId, { requestMTU: 512, timeout: 10000 });
      await this.device.discoverAllServicesAndCharacteristics();

      const services = await this.device.services();
      let writeChar = null;
      let notifyChar = null;

      for (const service of services) {
        const chars = await service.characteristics();
        for (const char of chars) {
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            writeChar = char;
            this.serviceUUID = service.uuid;
            this.writeCharUUID = char.uuid;
          }
          if (char.isNotifiable || char.isIndicatable) {
            notifyChar = char;
            this.notifyCharUUID = char.uuid;
            if (!this.serviceUUID) this.serviceUUID = service.uuid;
          }
        }
        if (writeChar && notifyChar) break;
      }

      if (!writeChar) return false;
      if (!notifyChar) this.notifyCharUUID = this.writeCharUUID;

      if (notifyChar && (notifyChar.isNotifiable || notifyChar.isIndicatable)) {
        this.device.monitorCharacteristicForService(
          this.serviceUUID, this.notifyCharUUID,
          (error, characteristic) => {
            if (error) { console.warn('OBD Notification Error:', error.message); return; }
            if (characteristic?.value) {
              const decoded = fromBase64(characteristic.value);
              this.responseBuffer += decoded;
              if (this.responseBuffer.includes('>')) {
                if (this.responseResolve) {
                  this.responseResolve(this.responseBuffer);
                  this.responseResolve = null;
                }
              }
            }
          }
        );
      }

      this.disconnectSubscription = this.device.onDisconnected(() => {
        console.log('OBD: Device disconnected');
        this._stopHeartbeat();
        this._notifyConnectionChange(false);
        this.device = null;
        this.supportedPIDs = new Set();
        this._scheduleReconnect();
      });

      // ELM327 initialisation sequence
      await this._sendRawCommand(AT_COMMANDS.RESET);        await this._delay(2000);
      await this._sendRawCommand(AT_COMMANDS.ECHO_OFF);     await this._delay(500);
      await this._sendRawCommand(AT_COMMANDS.LINEFEED_OFF); await this._delay(200);
      await this._sendRawCommand(AT_COMMANDS.HEADERS_OFF);  await this._delay(200);
      await this._sendRawCommand(AT_COMMANDS.SPACES_OFF);   await this._delay(200);
      await this._sendRawCommand(AT_COMMANDS.AUTO_PROTOCOL);await this._delay(2000);
      await this._sendRawCommand(AT_COMMANDS.ADAPTIVE_TIMING); await this._delay(200);
      await this._sendRawCommand(AT_COMMANDS.TIMEOUT);      await this._delay(200);

      // ── PID Discovery (paper Section 3.3.2) ──────────────────────────────
      // Send 0100/0120/0140/0160 to find which PIDs the vehicle supports.
      // 0100 is mandatory on all OBD-II vehicles — we use it to confirm the
      // ECU is responding, with retries to handle SEARCHING... timing.
      this.supportedPIDs = new Set();

      let r0100 = await this.sendCommand('0100\r');
      console.log('OBD: 0100 response:', r0100);

      // Wait out SEARCHING... or 7F negative response (ECU not ready yet)
      let retries = 0;
      while (retries < 8) {
        const up = (r0100 || '').toUpperCase();
        if (!up || up.includes('SEARCHING') || up.includes('TRYINGPROT') || up.startsWith('7F')) {
          console.log(`OBD: ECU not ready (${up.substring(0, 12) || 'empty'}), waiting... (${retries + 1}/8)`);
          await this._delay(3000);
          // Re-send protocol init before retrying — helps with slow ECUs
          if (retries === 3) {
            await this._sendRawCommand(AT_COMMANDS.AUTO_PROTOCOL);
            await this._delay(2000);
          }
          r0100 = await this.sendCommand('0100\r');
          console.log(`OBD: 0100 retry (${retries + 1}):`, r0100);
          retries++;
        } else {
          break;
        }
      }

      const up0100 = (r0100 || '').toUpperCase();
      if (!up0100 || up0100.includes('NODATA') || up0100.includes('UNABLE') || up0100.startsWith('7F')) {
        console.error('OBD: ECU not responding after retries — final response:', r0100);
        this.disconnect();
        return false;
      }

      // Parse supported PID ranges
      const pids0100 = parseSupportedPIDs(r0100, '00');
      pids0100.forEach(p => this.supportedPIDs.add(p));
      console.log('OBD: PIDs 01-20 supported:', [...pids0100]);

      const r0120 = await this.sendCommand('0120\r');
      const pids0120 = parseSupportedPIDs(r0120, '20');
      pids0120.forEach(p => this.supportedPIDs.add(p));
      console.log('OBD: PIDs 21-40 supported:', [...pids0120]);

      const r0140 = await this.sendCommand('0140\r');
      const pids0140 = parseSupportedPIDs(r0140, '40');
      pids0140.forEach(p => this.supportedPIDs.add(p));
      console.log('OBD: PIDs 41-60 supported:', [...pids0140]);

      const r0160 = await this.sendCommand('0160\r');
      const pids0160 = parseSupportedPIDs(r0160, '60');
      pids0160.forEach(p => this.supportedPIDs.add(p));
      console.log('OBD: PIDs 61-80 supported:', [...pids0160]);

      console.log('OBD: Total supported PIDs:', this.supportedPIDs.size);
      this.lastDeviceId = deviceId;
      this._notifyConnectionChange(true);
      this._startHeartbeat();
      return true;
    } catch (error) {
      console.error('OBD Connect Error:', error.message);
      this.disconnect();
      return false;
    }
  }

  _delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async _sendRawCommand(command) {
    if (!this.device || !this.writeCharUUID) return null;
    try {
      this.responseBuffer = '';
      const encoded = toBase64(command);
      await this.device.writeCharacteristicWithResponseForService(
        this.serviceUUID, this.writeCharUUID, encoded
      );
      const response = await Promise.race([
        new Promise(resolve => { this.responseResolve = resolve; }),
        this._delay(3000).then(() => this._readCharacteristic()),
      ]);
      this.responseResolve = null;
      return response || this.responseBuffer;
    } catch (error) {
      console.warn('OBD Command Error:', command.trim(), error.message);
      this.responseResolve = null;
      return null;
    }
  }

  async _readCharacteristic() {
    try {
      if (!this.device || !this.notifyCharUUID) return null;
      const char = await this.device.readCharacteristicForService(
        this.serviceUUID, this.notifyCharUUID
      );
      return char?.value ? fromBase64(char.value) : null;
    } catch { return null; }
  }

  async sendCommand(command) {
    return new Promise(resolve => {
      this.commandQueue.push({ command, resolve });
      this._processQueue();
    });
  }

  async _processQueue() {
    if (this.isProcessing || this.commandQueue.length === 0) return;
    this.isProcessing = true;
    while (this.commandQueue.length > 0) {
      const { command, resolve } = this.commandQueue.shift();
      const response = await this._sendRawCommand(command);
      resolve(response);
      await this._delay(100);
    }
    this.isProcessing = false;
  }

  // ── getSensorData — core dashboard sensors (fast, every 2s) ───────────────
  // Only queries PIDs confirmed supported during PID discovery in connect().
  async getSensorData() {
    if (!this.isConnected) return null;
    try {
      const data = {};

      // Helper: query only if PID is known supported
      const query = async (pidKey, pidName, pidHex) => {
        if (!this._isPIDSupported(pidHex)) return 0;
        const raw = await this.sendCommand(COMMANDS[pidKey]);
        const parsed = parseResponse(pidName, raw);
        if (parsed === null) console.log(`OBD RAW [${pidName}]:`, raw);
        return parsed || 0;
      };

      data.rpm         = await query('RPM',           'RPM',           '0C');
      data.speed       = await query('SPEED',         'SPEED',         '0D');
      data.coolantTemp = await query('COOLANT_TEMP',  'COOLANT_TEMP',  '05');
      data.throttle    = await query('THROTTLE',      'THROTTLE',      '11');
      data.fuelLevel   = await query('FUEL_LEVEL',    'FUEL_LEVEL',    '2F');
      data.engineLoad  = await query('ENGINE_LOAD',   'ENGINE_LOAD',   '04');
      data.voltage     = await query('CONTROL_VOLTAGE','CONTROL_VOLTAGE','42');
      data.intakeTemp  = await query('INTAKE_TEMP',   'INTAKE_TEMP',   '0F');
      data.maf         = await query('MAF',           'MAF',           '10');
      data.timing      = await query('TIMING_ADVANCE','TIMING_ADVANCE','0E');
      data.fuelPressure= await query('FUEL_PRESSURE', 'FUEL_PRESSURE', '0A');
      data.fuelTrim    = await query('SHORT_FUEL_TRIM','SHORT_FUEL_TRIM','06');

      return data;
    } catch (error) {
      console.warn('OBD getSensorData Error:', error.message);
      return null;
    }
  }

  // ── NEW: getExtendedSensorData — full sensor sweep (slower, on demand) ─────
  async getExtendedSensorData() {
    if (!this.isConnected) return null;
    try {
      const data = {};

      // Fuel system
      const ltft1Raw  = await this.sendCommand(COMMANDS.LONG_FUEL_TRIM_1);
      data.longFuelTrim1  = parseResponse('LONG_FUEL_TRIM_1', ltft1Raw);
      const stft2Raw  = await this.sendCommand(COMMANDS.SHORT_FUEL_TRIM_2);
      data.shortFuelTrim2 = parseResponse('SHORT_FUEL_TRIM_2', stft2Raw);
      const ltft2Raw  = await this.sendCommand(COMMANDS.LONG_FUEL_TRIM_2);
      data.longFuelTrim2  = parseResponse('LONG_FUEL_TRIM_2', ltft2Raw);
      const fuelRailRaw = await this.sendCommand(COMMANDS.FUEL_RAIL_PRESSURE);
      data.fuelRailPressure = parseResponse('FUEL_RAIL_PRESSURE', fuelRailRaw);

      // O2 sensors
      const o2b1s1Raw = await this.sendCommand(COMMANDS.O2_B1S1_VOLTAGE);
      data.o2Bank1Sensor1 = parseResponse('O2_B1S1_VOLTAGE', o2b1s1Raw);
      const o2b1s2Raw = await this.sendCommand(COMMANDS.O2_B1S2_VOLTAGE);
      data.o2Bank1Sensor2 = parseResponse('O2_B1S2_VOLTAGE', o2b1s2Raw);
      const o2b2s1Raw = await this.sendCommand(COMMANDS.O2_B2S1_VOLTAGE);
      data.o2Bank2Sensor1 = parseResponse('O2_B2S1_VOLTAGE', o2b2s1Raw);

      // Ambient & pressure
      const ambientRaw = await this.sendCommand(COMMANDS.AMBIENT_TEMP);
      data.ambientTemp = parseResponse('AMBIENT_TEMP', ambientRaw);
      const mapRaw    = await this.sendCommand(COMMANDS.MAP_PRESSURE);
      data.mapPressure = parseResponse('MAP_PRESSURE', mapRaw);
      const boostRaw  = await this.sendCommand(COMMANDS.BOOST_PRESSURE);
      data.boostPressure = parseResponse('BOOST_PRESSURE', boostRaw);

      // Oil & catalyst
      const oilRaw    = await this.sendCommand(COMMANDS.OIL_TEMP);
      data.oilTemp    = parseResponse('OIL_TEMP', oilRaw);
      const catRaw    = await this.sendCommand(COMMANDS.CATALYST_TEMP_B1S1);
      data.catalystTemp = parseResponse('CATALYST_TEMP_B1S1', catRaw);

      // EGR
      const egrRaw    = await this.sendCommand(COMMANDS.EGR_COMMANDED);
      data.egrCommanded = parseResponse('EGR_COMMANDED', egrRaw);
      const egrErrRaw = await this.sendCommand(COMMANDS.EGR_ERROR);
      data.egrError   = parseResponse('EGR_ERROR', egrErrRaw);

      // Throttle & pedal
      const throttleActRaw = await this.sendCommand(COMMANDS.THROTTLE_ACTUAL);
      data.throttleActual  = parseResponse('THROTTLE_ACTUAL', throttleActRaw);
      const accelDRaw = await this.sendCommand(COMMANDS.ACCEL_PEDAL_D);
      data.accelPedalD     = parseResponse('ACCEL_PEDAL_D', accelDRaw);

      // Fuel type
      const fuelTypeRaw = await this.sendCommand(COMMANDS.FUEL_TYPE);
      data.fuelType     = parseResponse('FUEL_TYPE', fuelTypeRaw);

      return data;
    } catch (error) {
      console.warn('OBD getExtendedSensorData Error:', error.message);
      return null;
    }
  }

  // ── NEW: getVehicleCounters — distance & runtime stats ────────────────────
  async getVehicleCounters() {
    if (!this.isConnected) return null;
    try {
      const data = {};

      const distMilRaw  = await this.sendCommand(COMMANDS.DISTANCE_MIL_ON);
      data.distanceMilOn      = parseResponse('DISTANCE_MIL_ON', distMilRaw);
      const distClrRaw  = await this.sendCommand(COMMANDS.DISTANCE_SINCE_CLR);
      data.distanceSinceClr   = parseResponse('DISTANCE_SINCE_CLR', distClrRaw);
      const runtimeRaw  = await this.sendCommand(COMMANDS.ENGINE_RUNTIME);
      data.engineRuntime      = parseResponse('ENGINE_RUNTIME', runtimeRaw);  // seconds
      const warmupsRaw  = await this.sendCommand(COMMANDS.WARMUPS_SINCE_CLR);
      data.warmupsSinceClr    = parseResponse('WARMUPS_SINCE_CLR', warmupsRaw);
      const rtMilRaw    = await this.sendCommand(COMMANDS.RUNTIME_MIL_ON);
      data.runtimeMilOn       = parseResponse('RUNTIME_MIL_ON', rtMilRaw);   // minutes
      const timeSinceRaw = await this.sendCommand(COMMANDS.TIME_SINCE_CLR);
      data.timeSinceClr       = parseResponse('TIME_SINCE_CLR', timeSinceRaw); // minutes

      return data;
    } catch (error) {
      console.warn('OBD getVehicleCounters Error:', error.message);
      return null;
    }
  }

  // ── NEW: getVehicleIdentity — VIN and ECU name ────────────────────────────
  async getVehicleIdentity() {
    if (!this.isConnected) return null;
    try {
      const vinRaw  = await this.sendCommand(COMMANDS.VIN);
      const ecuRaw  = await this.sendCommand(COMMANDS.ECU_NAME);
      return {
        vin:     parseVIN(vinRaw),
        ecuName: ecuRaw ? ecuRaw.replace(/[^a-zA-Z0-9 ]/g, '').trim() : null,
      };
    } catch (error) {
      console.warn('OBD getVehicleIdentity Error:', error.message);
      return null;
    }
  }

  // ── DTC methods (unchanged) ───────────────────────────────────────────────
  async getFaultCodes() {
    if (!this.isConnected) return [];
    try {
      const response        = await this.sendCommand(COMMANDS.READ_DTC);
      const codes           = parseFaultCodes(response);
      const pendingResponse = await this.sendCommand(COMMANDS.PENDING_DTC);
      const pendingCodes    = parseFaultCodes(pendingResponse);
      return [...new Set([...codes, ...pendingCodes])];
    } catch (error) {
      console.warn('OBD getFaultCodes Error:', error.message);
      return [];
    }
  }

  async clearFaultCodes() {
    if (!this.isConnected) return false;
    try {
      await this.sendCommand(COMMANDS.CLEAR_DTC);
      await this._delay(1000);
      return true;
    } catch (error) {
      console.warn('OBD clearFaultCodes Error:', error.message);
      return false;
    }
  }

  // ── Disconnect (user-initiated — disables auto-reconnect for this call) ────
  disconnect() {
    this._stopHeartbeat();
    this._cancelReconnect();
    try {
      if (this.disconnectSubscription) {
        this.disconnectSubscription.remove();
        this.disconnectSubscription = null;
      }
      if (this.device) this.device.cancelConnection();
    } catch (e) {
      console.warn('OBD Disconnect Error:', e.message);
    }
    this.device = null;
    this.serviceUUID = null;
    this.writeCharUUID = null;
    this.notifyCharUUID = null;
    this.commandQueue = [];
    this.isProcessing = false;
    this.responseResolve = null;
    this._notifyConnectionChange(false);
  }
}

export default new OBDService();