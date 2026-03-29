import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

// Base64 helpers for React Native
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

// Standard ELM327 BLE Service and Characteristic UUIDs
const ELM327_SERVICE_UUIDS = [
  'fff0',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // SPP
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Common BLE OBD
];

// OBD-II AT Commands
const AT_COMMANDS = {
  RESET: 'ATZ\r',
  ECHO_OFF: 'ATE0\r',
  LINEFEED_OFF: 'ATL0\r',
  HEADERS_OFF: 'ATH0\r',
  SPACES_OFF: 'ATS0\r',
  AUTO_PROTOCOL: 'ATSP0\r',
  ADAPTIVE_TIMING: 'ATAT1\r',
  TIMEOUT: 'ATST32\r',
};

// OBD-II PID Commands
const COMMANDS = {
  RPM: '010C\r',
  SPEED: '010D\r',
  COOLANT_TEMP: '0105\r',
  THROTTLE: '0111\r',
  FUEL_LEVEL: '012F\r',
  ENGINE_LOAD: '0104\r',
  CONTROL_VOLTAGE: '0142\r',
  INTAKE_TEMP: '010F\r',
  MAF: '0110\r',
  TIMING_ADVANCE: '010E\r',
  FUEL_PRESSURE: '010A\r',
  SHORT_FUEL_TRIM: '0106\r',
  BAROMETRIC: '0133\r',
  OIL_TEMP: '015C\r',
  READ_DTC: '03\r',
  CLEAR_DTC: '04\r',
  PENDING_DTC: '07\r',
};

// Parse OBD-II response data
const parseResponse = (pid, rawData) => {
  try {
    if (!rawData) return null;

    const cleaned = rawData
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .replace(/>/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toUpperCase();

    if (
      cleaned.includes('NODATA') ||
      cleaned.includes('ERROR') ||
      cleaned.includes('UNABLE') ||
      cleaned.includes('STOPPED') ||
      cleaned.includes('?')
    ) {
      return null;
    }

    // Find the response bytes after the echo/header
    // Standard response format: 41 XX YY ZZ (for mode 01 responses)
    let hexData = cleaned;

    // Remove any echo of the command
    const mode41Index = hexData.indexOf('41');
    if (mode41Index >= 0) {
      hexData = hexData.substring(mode41Index);
    }

    const bytes = hexData.match(/.{1,2}/g);
    if (!bytes || bytes.length < 3) return null;

    // bytes[0] = '41' (response), bytes[1] = PID, bytes[2+] = data
    const A = parseInt(bytes[2], 16);
    const B = bytes.length > 3 ? parseInt(bytes[3], 16) : 0;

    if (isNaN(A)) return null;

    switch (pid) {
      case 'RPM':
        return Math.round((A * 256 + B) / 4);
      case 'SPEED':
        return A;
      case 'COOLANT_TEMP':
      case 'INTAKE_TEMP':
      case 'OIL_TEMP':
        return A - 40;
      case 'THROTTLE':
      case 'FUEL_LEVEL':
      case 'ENGINE_LOAD':
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
        return parseFloat((A / 1.28 - 100).toFixed(1));
      case 'BAROMETRIC':
        return A;
      default:
        return null;
    }
  } catch (e) {
    console.warn('OBD Parse Error:', pid, e.message);
    return null;
  }
};

// Parse DTC (Diagnostic Trouble Codes)
const parseFaultCodes = (rawData) => {
  try {
    if (!rawData) return [];

    const cleaned = rawData
      .replace(/\r/g, '')
      .replace(/\n/g, '')
      .replace(/>/g, '')
      .replace(/\s+/g, '')
      .trim()
      .toUpperCase();

    if (cleaned.includes('NODATA') || cleaned.length < 4) return [];

    // Remove '43' header (mode 03 response)
    let hexData = cleaned;
    const mode43Index = hexData.indexOf('43');
    if (mode43Index >= 0) {
      hexData = hexData.substring(mode43Index + 2);
    }

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
      if (code !== 'P0000') {
        codes.push(code);
      }
    }

    return codes;
  } catch (e) {
    console.warn('DTC Parse Error:', e.message);
    return [];
  }
};

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
  }

  // Register connection state listener
  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(
        (cb) => cb !== callback
      );
    };
  }

  _notifyConnectionChange(connected) {
    this.isConnected = connected;
    this.connectionListeners.forEach((cb) => cb(connected));
  }

  // Connect to an ELM327 BLE device
  async connect(deviceId) {
    try {
      console.log('OBD: Connecting to device:', deviceId);

      this.device = await manager.connectToDevice(deviceId, {
        requestMTU: 512,
        timeout: 10000,
      });

      console.log('OBD: Device connected, discovering services...');
      await this.device.discoverAllServicesAndCharacteristics();

      // Find the correct service and characteristics
      const services = await this.device.services();
      let writeChar = null;
      let notifyChar = null;

      for (const service of services) {
        const chars = await service.characteristics();
        for (const char of chars) {
          if (
            char.isWritableWithResponse ||
            char.isWritableWithoutResponse
          ) {
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

      if (!writeChar) {
        console.error('OBD: No writable characteristic found');
        return false;
      }

      // If no notification char found, use the writable char for reading too
      if (!notifyChar) {
        this.notifyCharUUID = this.writeCharUUID;
      }

      // Set up notification listener for responses
      if (notifyChar && (notifyChar.isNotifiable || notifyChar.isIndicatable)) {
        this.device.monitorCharacteristicForService(
          this.serviceUUID,
          this.notifyCharUUID,
          (error, characteristic) => {
            if (error) {
              console.warn('OBD Notification Error:', error.message);
              return;
            }
            if (characteristic && characteristic.value) {
              const decoded = fromBase64(characteristic.value);
              this.responseBuffer += decoded;

              // ELM327 response ends with '>' prompt
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

      // Monitor disconnection
      this.disconnectSubscription = this.device.onDisconnected(
        (error, device) => {
          console.log('OBD: Device disconnected');
          this._notifyConnectionChange(false);
          this.device = null;
        }
      );

      // Initialize ELM327
      console.log('OBD: Initializing ELM327...');

      await this._sendRawCommand(AT_COMMANDS.RESET);
      await this._delay(1500);

      await this._sendRawCommand(AT_COMMANDS.ECHO_OFF);
      await this._delay(500);

      await this._sendRawCommand(AT_COMMANDS.LINEFEED_OFF);
      await this._delay(200);

      await this._sendRawCommand(AT_COMMANDS.HEADERS_OFF);
      await this._delay(200);

      await this._sendRawCommand(AT_COMMANDS.SPACES_OFF);
      await this._delay(200);

      await this._sendRawCommand(AT_COMMANDS.AUTO_PROTOCOL);
      await this._delay(500);

      await this._sendRawCommand(AT_COMMANDS.ADAPTIVE_TIMING);
      await this._delay(200);

      await this._sendRawCommand(AT_COMMANDS.TIMEOUT);
      await this._delay(200);

      // Try a test command to verify communication
      const testResponse = await this.sendCommand(COMMANDS.RPM);
      console.log('OBD: Test RPM response:', testResponse);

      this._notifyConnectionChange(true);
      console.log('OBD: Connection and initialization complete!');
      return true;
    } catch (error) {
      console.error('OBD Connect Error:', error.message);
      this.disconnect();
      return false;
    }
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Send raw command and wait for response
  async _sendRawCommand(command) {
    if (!this.device || !this.writeCharUUID) return null;

    try {
      this.responseBuffer = '';
      const encoded = toBase64(command);

      if (
        this.device &&
        this.writeCharUUID
      ) {
        await this.device.writeCharacteristicWithResponseForService(
          this.serviceUUID,
          this.writeCharUUID,
          encoded
        );
      }

      // Wait for response via notification or read
      const response = await Promise.race([
        new Promise((resolve) => {
          this.responseResolve = resolve;
        }),
        this._delay(3000).then(() => {
          // Timeout: try to read characteristic directly
          return this._readCharacteristic();
        }),
      ]);

      this.responseResolve = null;
      return response || this.responseBuffer;
    } catch (error) {
      console.warn('OBD Command Error:', command.trim(), error.message);
      this.responseResolve = null;
      return null;
    }
  }

  // Fallback: read characteristic directly
  async _readCharacteristic() {
    try {
      if (!this.device || !this.notifyCharUUID) return null;
      const char = await this.device.readCharacteristicForService(
        this.serviceUUID,
        this.notifyCharUUID
      );
      return char?.value ? fromBase64(char.value) : null;
    } catch {
      return null;
    }
  }

  // Public: send OBD command (queued, sequential)
  async sendCommand(command) {
    return new Promise((resolve) => {
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
      await this._delay(100); // Small gap between commands
    }

    this.isProcessing = false;
  }

  // Get all sensor data sequentially
  async getSensorData() {
    if (!this.isConnected) return null;

    try {
      const data = {};

      // Send commands one at a time (ELM327 is serial)
      const rpmRaw = await this.sendCommand(COMMANDS.RPM);
      data.rpm = parseResponse('RPM', rpmRaw) || 0;

      const speedRaw = await this.sendCommand(COMMANDS.SPEED);
      data.speed = parseResponse('SPEED', speedRaw) || 0;

      const coolantRaw = await this.sendCommand(COMMANDS.COOLANT_TEMP);
      data.coolantTemp = parseResponse('COOLANT_TEMP', coolantRaw) || 0;

      const throttleRaw = await this.sendCommand(COMMANDS.THROTTLE);
      data.throttle = parseResponse('THROTTLE', throttleRaw) || 0;

      const fuelRaw = await this.sendCommand(COMMANDS.FUEL_LEVEL);
      data.fuelLevel = parseResponse('FUEL_LEVEL', fuelRaw) || 0;

      const loadRaw = await this.sendCommand(COMMANDS.ENGINE_LOAD);
      data.engineLoad = parseResponse('ENGINE_LOAD', loadRaw) || 0;

      const voltageRaw = await this.sendCommand(COMMANDS.CONTROL_VOLTAGE);
      data.voltage = parseResponse('CONTROL_VOLTAGE', voltageRaw) || 0;

      const intakeRaw = await this.sendCommand(COMMANDS.INTAKE_TEMP);
      data.intakeTemp = parseResponse('INTAKE_TEMP', intakeRaw) || 0;

      const mafRaw = await this.sendCommand(COMMANDS.MAF);
      data.maf = parseResponse('MAF', mafRaw) || 0;

      const timingRaw = await this.sendCommand(COMMANDS.TIMING_ADVANCE);
      data.timing = parseResponse('TIMING_ADVANCE', timingRaw) || 0;

      const fuelPressureRaw = await this.sendCommand(COMMANDS.FUEL_PRESSURE);
      data.fuelPressure = parseResponse('FUEL_PRESSURE', fuelPressureRaw) || 0;

      const fuelTrimRaw = await this.sendCommand(COMMANDS.SHORT_FUEL_TRIM);
      data.fuelTrim = parseResponse('SHORT_FUEL_TRIM', fuelTrimRaw) || 0;

      return data;
    } catch (error) {
      console.warn('OBD getSensorData Error:', error.message);
      return null;
    }
  }

  // Read fault codes (DTC)
  async getFaultCodes() {
    if (!this.isConnected) return [];

    try {
      const response = await this.sendCommand(COMMANDS.READ_DTC);
      const codes = parseFaultCodes(response);

      // Also check pending codes
      const pendingResponse = await this.sendCommand(COMMANDS.PENDING_DTC);
      const pendingCodes = parseFaultCodes(pendingResponse);

      // Merge without duplicates
      const allCodes = [...new Set([...codes, ...pendingCodes])];
      return allCodes;
    } catch (error) {
      console.warn('OBD getFaultCodes Error:', error.message);
      return [];
    }
  }

  // Clear fault codes
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

  // Disconnect from device
  disconnect() {
    try {
      if (this.disconnectSubscription) {
        this.disconnectSubscription.remove();
        this.disconnectSubscription = null;
      }
      if (this.device) {
        this.device.cancelConnection();
      }
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