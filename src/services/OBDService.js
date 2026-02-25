import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

// OBD-II Commands
const COMMANDS = {
  INIT: 'ATZ\r',
  ECHO_OFF: 'ATE0\r',
  PROTOCOL: 'ATSP0\r',
  RPM: '010C\r',
  SPEED: '010D\r',
  COOLANT: '0105\r',
  THROTTLE: '0111\r',
  FUEL: '012F\r',
  LOAD: '0104\r',
  VOLTAGE: '0142\r',
  FAULTS: '03\r', // Get fault codes
};

// Parse OBD responses
const parseResponse = (pid, data) => {
  try {
    const cleaned = data.replace(/\s/g, '').replace('>', '').trim();
    
    if (cleaned.includes('NODATA') || cleaned.includes('ERROR')) {
      return null;
    }

    const bytes = cleaned.match(/.{1,2}/g);
    if (!bytes || bytes.length < 3) return null;

    const A = parseInt(bytes[2], 16);
    const B = bytes[3] ? parseInt(bytes[3], 16) : 0;

    switch (pid) {
      case 'RPM':
        return Math.round(((A * 256) + B) / 4);
      case 'SPEED':
        return A;
      case 'COOLANT':
        return A - 40;
      case 'THROTTLE':
      case 'FUEL':
      case 'LOAD':
        return Math.round((A / 255) * 100);
      case 'VOLTAGE':
        return ((A * 256) + B) / 1000;
      default:
        return null;
    }
  } catch {
    return null;
  }
};

// Parse fault codes
const parseFaultCodes = (data) => {
  try {
    const cleaned = data.replace(/\s/g, '').replace('43', '');
    const codes = [];
    
    for (let i = 0; i < cleaned.length; i += 4) {
      const code = cleaned.substr(i, 4);
      if (code !== '0000') {
        const type = ['P', 'C', 'B', 'U'][parseInt(code[0], 16) >> 2];
        const formatted = type + code.substr(1);
        codes.push(formatted);
      }
    }
    
    return codes;
  } catch {
    return [];
  }
};

class OBDService {
  constructor() {
    this.device = null;
    this.serviceUUID = null;
    this.charUUID = null;
    this.isConnected = false;
  }

  async connect(deviceId) {
    try {
      this.device = await manager.connectToDevice(deviceId);
      await this.device.discoverAllServicesAndCharacteristics();

      const services = await this.device.services();
      for (const service of services) {
        const chars = await service.characteristics();
        for (const char of chars) {
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            this.serviceUUID = service.uuid;
            this.charUUID = char.uuid;
            break;
          }
        }
      }

      if (this.charUUID) {
        await this.sendCommand(COMMANDS.INIT);
        await new Promise(r => setTimeout(r, 1000));
        await this.sendCommand(COMMANDS.ECHO_OFF);
        await new Promise(r => setTimeout(r, 500));
        await this.sendCommand(COMMANDS.PROTOCOL);
        await new Promise(r => setTimeout(r, 500));
        
        this.isConnected = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('OBD Connect Error:', error);
      return false;
    }
  }

  async sendCommand(command) {
    if (!this.device || !this.charUUID) return null;

    try {
      const encoded = btoa(command);
      await this.device.writeCharacteristicWithResponseForService(
        this.serviceUUID,
        this.charUUID,
        encoded
      );

      await new Promise(r => setTimeout(r, 300));

      const response = await this.device.readCharacteristicForService(
        this.serviceUUID,
        this.charUUID
      );

      return response?.value ? atob(response.value) : null;
    } catch {
      return null;
    }
  }

  async getSensorData() {
    if (!this.isConnected) return null;

    try {
      const [rpm, speed, coolant, throttle, fuel, load, voltage] = 
        await Promise.all([
          this.sendCommand(COMMANDS.RPM),
          this.sendCommand(COMMANDS.SPEED),
          this.sendCommand(COMMANDS.COOLANT),
          this.sendCommand(COMMANDS.THROTTLE),
          this.sendCommand(COMMANDS.FUEL),
          this.sendCommand(COMMANDS.LOAD),
          this.sendCommand(COMMANDS.VOLTAGE),
        ]);

      return {
        rpm: parseResponse('RPM', rpm) || 0,
        speed: parseResponse('SPEED', speed) || 0,
        coolantTemp: parseResponse('COOLANT', coolant) || 0,
        throttle: parseResponse('THROTTLE', throttle) || 0,
        fuelLevel: parseResponse('FUEL', fuel) || 0,
        engineLoad: parseResponse('LOAD', load) || 0,
        voltage: parseResponse('VOLTAGE', voltage) || 0,
      };
    } catch {
      return null;
    }
  }

  async getFaultCodes() {
    if (!this.isConnected) return [];

    try {
      const response = await this.sendCommand(COMMANDS.FAULTS);
      return parseFaultCodes(response);
    } catch {
      return [];
    }
  }

  disconnect() {
    if (this.device) {
      this.device.cancelConnection();
      this.device = null;
      this.isConnected = false;
    }
  }
}

export default new OBDService();