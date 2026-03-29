/**
 * OBD-II Fault Code Database
 * Supports: Standard OBD-II (P0xxx), Toyota, Nissan, Honda manufacturer codes (P1xxx)
 */

// Standard OBD-II fault codes (P0xxx)
const STANDARD_CODES = {
  P0010: { description: 'Intake Camshaft Position Actuator Circuit (Bank 1)', severity: 'Warning', cause: 'Faulty camshaft position actuator or wiring', fix: 'Check actuator solenoid and wiring' },
  P0011: { description: 'Intake Camshaft Position - Timing Over-Advanced (Bank 1)', severity: 'Warning', cause: 'Engine timing issue or oil flow problem', fix: 'Check engine oil level and VVT solenoid' },
  P0012: { description: 'Intake Camshaft Position - Timing Over-Retarded (Bank 1)', severity: 'Warning', cause: 'Engine timing issue or oil flow problem', fix: 'Check engine oil level and VVT solenoid' },
  P0016: { description: 'Crankshaft Position - Camshaft Position Correlation (Bank 1)', severity: 'Critical', cause: 'Timing chain/belt stretched or jumped', fix: 'Inspect timing chain/belt and tensioners' },
  P0100: { description: 'Mass Air Flow Circuit Malfunction', severity: 'Warning', cause: 'Faulty MAF sensor or dirty element', fix: 'Clean or replace MAF sensor' },
  P0101: { description: 'Mass Air Flow Circuit Range/Performance', severity: 'Warning', cause: 'Dirty MAF sensor or air leak', fix: 'Clean MAF sensor, check for vacuum leaks' },
  P0102: { description: 'Mass Air Flow Circuit Low Input', severity: 'Warning', cause: 'Faulty MAF sensor or wiring', fix: 'Check MAF sensor wiring and connector' },
  P0110: { description: 'Intake Air Temperature Circuit Malfunction', severity: 'Info', cause: 'Faulty IAT sensor or wiring', fix: 'Check IAT sensor and connector' },
  P0115: { description: 'Engine Coolant Temperature Circuit Malfunction', severity: 'Warning', cause: 'Faulty ECT sensor or wiring', fix: 'Check coolant temperature sensor' },
  P0120: { description: 'Throttle Position Sensor Circuit Malfunction', severity: 'Warning', cause: 'Faulty TPS or wiring', fix: 'Check throttle position sensor' },
  P0121: { description: 'Throttle Position Sensor Range/Performance', severity: 'Warning', cause: 'TPS out of range', fix: 'Replace throttle position sensor' },
  P0128: { description: 'Coolant Thermostat Below Regulating Temperature', severity: 'Info', cause: 'Thermostat stuck open', fix: 'Replace thermostat' },
  P0130: { description: 'O2 Sensor Circuit Malfunction (Bank 1 Sensor 1)', severity: 'Warning', cause: 'Faulty oxygen sensor', fix: 'Replace O2 sensor' },
  P0131: { description: 'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)', severity: 'Warning', cause: 'Lean condition or faulty O2 sensor', fix: 'Check for vacuum leaks, replace O2 sensor' },
  P0133: { description: 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)', severity: 'Warning', cause: 'Aging or faulty O2 sensor', fix: 'Replace O2 sensor' },
  P0135: { description: 'O2 Sensor Heater Circuit Malfunction (Bank 1 Sensor 1)', severity: 'Warning', cause: 'Faulty heater circuit in O2 sensor', fix: 'Check fuse and replace O2 sensor' },
  P0141: { description: 'O2 Sensor Heater Circuit Malfunction (Bank 1 Sensor 2)', severity: 'Warning', cause: 'Faulty heater circuit in O2 sensor', fix: 'Check fuse and replace O2 sensor' },
  P0171: { description: 'System Too Lean (Bank 1)', severity: 'Warning', cause: 'Vacuum leak, faulty MAF, or fuel delivery issue', fix: 'Check vacuum lines, MAF sensor, fuel filter' },
  P0172: { description: 'System Too Rich (Bank 1)', severity: 'Warning', cause: 'Faulty O2 sensor, fuel injector, or fuel regulator', fix: 'Check fuel injectors and O2 sensors' },
  P0174: { description: 'System Too Lean (Bank 2)', severity: 'Warning', cause: 'Vacuum leak or fuel delivery issue', fix: 'Check vacuum lines and fuel system' },
  P0175: { description: 'System Too Rich (Bank 2)', severity: 'Warning', cause: 'Fuel system issue', fix: 'Check fuel injectors and O2 sensors' },
  P0300: { description: 'Random/Multiple Cylinder Misfire Detected', severity: 'Critical', cause: 'Spark plugs, ignition coils, fuel injectors, or compression', fix: 'Check spark plugs, coils, and fuel injectors' },
  P0301: { description: 'Cylinder 1 Misfire Detected', severity: 'Critical', cause: 'Faulty spark plug, ignition coil, or fuel injector', fix: 'Replace spark plug and ignition coil for Cyl 1' },
  P0302: { description: 'Cylinder 2 Misfire Detected', severity: 'Critical', cause: 'Faulty spark plug, ignition coil, or fuel injector', fix: 'Replace spark plug and ignition coil for Cyl 2' },
  P0303: { description: 'Cylinder 3 Misfire Detected', severity: 'Critical', cause: 'Faulty spark plug, ignition coil, or fuel injector', fix: 'Replace spark plug and ignition coil for Cyl 3' },
  P0304: { description: 'Cylinder 4 Misfire Detected', severity: 'Critical', cause: 'Faulty spark plug, ignition coil, or fuel injector', fix: 'Replace spark plug and ignition coil for Cyl 4' },
  P0325: { description: 'Knock Sensor Circuit Malfunction (Bank 1)', severity: 'Warning', cause: 'Faulty knock sensor or wiring', fix: 'Replace knock sensor' },
  P0335: { description: 'Crankshaft Position Sensor Circuit Malfunction', severity: 'Critical', cause: 'Faulty CKP sensor or wiring', fix: 'Replace crankshaft position sensor' },
  P0340: { description: 'Camshaft Position Sensor Circuit Malfunction', severity: 'Critical', cause: 'Faulty CMP sensor or wiring', fix: 'Replace camshaft position sensor' },
  P0401: { description: 'EGR Flow Insufficient Detected', severity: 'Warning', cause: 'Clogged EGR valve or passages', fix: 'Clean or replace EGR valve' },
  P0420: { description: 'Catalyst System Efficiency Below Threshold (Bank 1)', severity: 'Warning', cause: 'Failing catalytic converter', fix: 'Replace catalytic converter' },
  P0430: { description: 'Catalyst System Efficiency Below Threshold (Bank 2)', severity: 'Warning', cause: 'Failing catalytic converter', fix: 'Replace catalytic converter' },
  P0440: { description: 'Evaporative Emission Control System Malfunction', severity: 'Info', cause: 'Loose gas cap or EVAP leak', fix: 'Tighten gas cap, check EVAP system' },
  P0441: { description: 'Evaporative Emission Control System Incorrect Purge Flow', severity: 'Info', cause: 'Faulty purge valve', fix: 'Replace purge valve' },
  P0442: { description: 'Evaporative Emission Control System Leak Detected (Small)', severity: 'Info', cause: 'Small EVAP leak, loose gas cap', fix: 'Tighten gas cap, smoke test EVAP system' },
  P0446: { description: 'Evaporative Emission Control System Vent Control Circuit', severity: 'Info', cause: 'Faulty vent valve', fix: 'Replace EVAP vent solenoid' },
  P0455: { description: 'Evaporative Emission Control System Leak Detected (Large)', severity: 'Warning', cause: 'Large EVAP leak, missing gas cap', fix: 'Check gas cap and EVAP hoses' },
  P0500: { description: 'Vehicle Speed Sensor Malfunction', severity: 'Warning', cause: 'Faulty VSS or wiring', fix: 'Replace vehicle speed sensor' },
  P0505: { description: 'Idle Control System Malfunction', severity: 'Warning', cause: 'Faulty IAC valve or throttle body', fix: 'Clean throttle body, check IAC valve' },
  P0507: { description: 'Idle Control System RPM Higher Than Expected', severity: 'Warning', cause: 'Vacuum leak or faulty IAC valve', fix: 'Check for vacuum leaks, clean IAC valve' },
  P0562: { description: 'System Voltage Low', severity: 'Warning', cause: 'Weak battery or alternator issue', fix: 'Test battery and alternator output' },
  P0600: { description: 'Serial Communication Link Malfunction', severity: 'Critical', cause: 'ECU internal communication error', fix: 'Check ECU connections, may need ECU replacement' },
  P0700: { description: 'Transmission Control System Malfunction', severity: 'Warning', cause: 'Transmission control module issue', fix: 'Scan transmission codes separately' },
  P0705: { description: 'Transmission Range Sensor Circuit Malfunction', severity: 'Warning', cause: 'Faulty neutral safety switch', fix: 'Replace transmission range sensor' },
  P0715: { description: 'Input/Turbine Speed Sensor Circuit Malfunction', severity: 'Warning', cause: 'Faulty input speed sensor', fix: 'Replace input speed sensor' },
  P0720: { description: 'Output Speed Sensor Circuit Malfunction', severity: 'Warning', cause: 'Faulty output speed sensor', fix: 'Replace output speed sensor' },
  P0741: { description: 'Torque Converter Clutch Circuit Stuck Off', severity: 'Warning', cause: 'Faulty TCC solenoid or wiring', fix: 'Replace TCC solenoid' },
};

// Toyota-specific fault codes
const TOYOTA_CODES = {
  P1100: { description: 'Barometric Pressure Sensor Circuit', severity: 'Warning', cause: 'Faulty barometric sensor', fix: 'Replace barometric pressure sensor' },
  P1120: { description: 'Accelerator Pedal Position Sensor Circuit', severity: 'Warning', cause: 'Faulty APP sensor', fix: 'Check accelerator pedal position sensor' },
  P1121: { description: 'Accelerator Pedal Position Sensor Range/Performance', severity: 'Warning', cause: 'APP sensor out of range', fix: 'Replace accelerator pedal position sensor' },
  P1125: { description: 'Throttle Control Motor Circuit', severity: 'Critical', cause: 'Faulty electronic throttle motor', fix: 'Check throttle body assembly' },
  P1127: { description: 'ETCS Actuator Power Source Circuit', severity: 'Critical', cause: 'Throttle actuator power issue', fix: 'Check throttle body wiring and power supply' },
  P1128: { description: 'Throttle Control Motor Lock', severity: 'Critical', cause: 'Throttle motor stuck or jammed', fix: 'Clean or replace throttle body' },
  P1130: { description: 'Air/Fuel Sensor Circuit Response (Bank 1 Sensor 1)', severity: 'Warning', cause: 'Slow A/F sensor response', fix: 'Replace air/fuel ratio sensor' },
  P1133: { description: 'Air/Fuel Sensor Circuit Response (Bank 2 Sensor 1)', severity: 'Warning', cause: 'Slow A/F sensor response', fix: 'Replace air/fuel ratio sensor' },
  P1135: { description: 'Air/Fuel Sensor Heater Circuit (Bank 1 Sensor 1)', severity: 'Warning', cause: 'A/F sensor heater issue', fix: 'Replace air/fuel ratio sensor' },
  P1150: { description: 'Air/Fuel Sensor Circuit (Bank 1 Sensor 2)', severity: 'Warning', cause: 'Faulty A/F sensor', fix: 'Replace air/fuel ratio sensor' },
  P1155: { description: 'Air/Fuel Sensor Heater Circuit (Bank 2 Sensor 1)', severity: 'Warning', cause: 'A/F sensor heater issue', fix: 'Replace air/fuel ratio sensor' },
  P1200: { description: 'Fuel Injector Circuit', severity: 'Warning', cause: 'Fuel injector malfunction', fix: 'Check fuel injector wiring and connectors' },
  P1300: { description: 'Igniter Circuit Malfunction No. 1', severity: 'Critical', cause: 'Faulty ignition coil or igniter', fix: 'Replace ignition coil and igniter' },
  P1310: { description: 'Igniter Circuit Malfunction No. 2', severity: 'Critical', cause: 'Faulty ignition coil or igniter', fix: 'Replace ignition coil and igniter' },
  P1335: { description: 'Crankshaft Position Sensor Circuit (During Engine Running)', severity: 'Critical', cause: 'CKP sensor signal interrupted', fix: 'Check CKP sensor and wiring' },
  P1346: { description: 'VVT Sensor / Camshaft Position Sensor Range/Performance', severity: 'Warning', cause: 'VVT system issue', fix: 'Check VVT system, oil viscosity' },
  P1349: { description: 'VVT System Malfunction', severity: 'Warning', cause: 'Variable valve timing system failure', fix: 'Check VVT actuator and oil control valve' },
  P1351: { description: 'VVT Sensor / Camshaft Position Sensor Circuit (Bank 1)', severity: 'Warning', cause: 'CMP sensor issue', fix: 'Replace camshaft position sensor' },
  P1500: { description: 'Starter Signal Circuit', severity: 'Info', cause: 'Starter relay circuit', fix: 'Check starter relay and wiring' },
  P1520: { description: 'Stop Light Switch Circuit', severity: 'Info', cause: 'Brake light switch issue', fix: 'Adjust or replace brake light switch' },
  P1600: { description: 'ECM Communication Circuit', severity: 'Critical', cause: 'ECU communication failure', fix: 'Check ECU connections and power supply' },
  P1604: { description: 'Startability Malfunction', severity: 'Warning', cause: 'Engine starting difficulty', fix: 'Check fuel, ignition, and compression' },
  P1605: { description: 'Knock Control CPU', severity: 'Critical', cause: 'Knock control module failure', fix: 'Check ECU and knock sensor system' },
  P1700: { description: 'Vehicle Speed Sensor Circuit', severity: 'Warning', cause: 'VSS malfunction', fix: 'Replace vehicle speed sensor' },
  P1765: { description: 'Linear Shift Solenoid Circuit', severity: 'Warning', cause: 'Transmission solenoid issue', fix: 'Check transmission solenoids' },
};

// Nissan-specific fault codes
const NISSAN_CODES = {
  P1105: { description: 'MAP/BARO Pressure Switch Solenoid Valve', severity: 'Warning', cause: 'Faulty solenoid valve', fix: 'Check MAP/BARO solenoid' },
  P1110: { description: 'Intake Valve Timing Control Solenoid (Bank 1)', severity: 'Warning', cause: 'VVT solenoid issue', fix: 'Replace VVT solenoid' },
  P1111: { description: 'Intake Valve Timing Control (Bank 1)', severity: 'Warning', cause: 'VVT system performance issue', fix: 'Check VVT system and oil level' },
  P1120: { description: 'Throttle Position Sensor Signal Circuit', severity: 'Warning', cause: 'TPS circuit issue', fix: 'Check throttle position sensor' },
  P1121: { description: 'Throttle Position Sensor Signal Range/Performance', severity: 'Warning', cause: 'TPS out of range', fix: 'Replace throttle position sensor' },
  P1126: { description: 'Thermostat Function', severity: 'Info', cause: 'Thermostat malfunction', fix: 'Replace thermostat' },
  P1130: { description: 'Swirl Control Valve Circuit (Bank 1)', severity: 'Warning', cause: 'Swirl control valve issue', fix: 'Check swirl control valve' },
  P1140: { description: 'Intake Valve Timing Control Position Sensor (Bank 1)', severity: 'Warning', cause: 'VVT position sensor issue', fix: 'Check VVT position sensor' },
  P1148: { description: 'Closed Loop Control Function (Bank 1)', severity: 'Warning', cause: 'Fuel system not entering closed loop', fix: 'Check O2 sensors and fuel system' },
  P1210: { description: 'Injector Leak/Stuck Open', severity: 'Critical', cause: 'Fuel injector leaking', fix: 'Replace faulty fuel injector' },
  P1217: { description: 'Engine Over Temperature Condition', severity: 'Critical', cause: 'Engine overheating', fix: 'Check cooling system immediately' },
  P1220: { description: 'Fuel Pump Control Circuit', severity: 'Warning', cause: 'Fuel pump relay issue', fix: 'Check fuel pump relay and wiring' },
  P1320: { description: 'Ignition Signal Primary Circuit', severity: 'Critical', cause: 'Ignition coil primary circuit failure', fix: 'Check ignition coils and wiring' },
  P1336: { description: 'Crankshaft Position Sensor (Learned Value Not Stored)', severity: 'Info', cause: 'CKP needs relearn procedure', fix: 'Perform CKP sensor relearn procedure' },
  P1400: { description: 'EGRC Solenoid Valve Circuit', severity: 'Warning', cause: 'EGR solenoid valve circuit issue', fix: 'Check EGR solenoid wiring' },
  P1401: { description: 'EGR Temperature Sensor Circuit', severity: 'Warning', cause: 'EGR temp sensor issue', fix: 'Replace EGR temperature sensor' },
  P1402: { description: 'EGR System Malfunction', severity: 'Warning', cause: 'EGR system not functioning', fix: 'Clean or replace EGR valve' },
  P1440: { description: 'EVAP Control System Small Leak', severity: 'Info', cause: 'Small EVAP leak', fix: 'Check gas cap and EVAP system' },
  P1441: { description: 'EVAP Canister Purge Volume Control Valve', severity: 'Info', cause: 'Purge valve issue', fix: 'Replace EVAP purge valve' },
  P1490: { description: 'EVAP Canister Vacuum Cut Valve/Bypass Valve', severity: 'Info', cause: 'EVAP valve issue', fix: 'Check EVAP vacuum cut valve' },
  P1550: { description: 'Battery Current Sensor Circuit', severity: 'Warning', cause: 'Battery sensor issue', fix: 'Check battery current sensor' },
  P1610: { description: 'NATS Malfunction (Immobilizer)', severity: 'Critical', cause: 'Immobilizer system error', fix: 'Check key transponder and NATS module' },
  P1614: { description: 'NATS Error - Wrong Key', severity: 'Critical', cause: 'Wrong key or key not registered', fix: 'Use correct registered key' },
  P1705: { description: 'Throttle Position Sensor at Transmission', severity: 'Warning', cause: 'TPS signal to transmission issue', fix: 'Check TPS and wiring to TCM' },
  P1800: { description: 'Variable Intake Air System Solenoid', severity: 'Warning', cause: 'Intake solenoid issue', fix: 'Check variable intake solenoid' },
};

// Honda-specific fault codes
const HONDA_CODES = {
  P1106: { description: 'Barometric Pressure Circuit Range/Performance', severity: 'Warning', cause: 'BARO sensor issue', fix: 'Check barometric pressure sensor' },
  P1107: { description: 'Barometric Pressure Circuit Low Input', severity: 'Warning', cause: 'Low BARO signal', fix: 'Replace barometric pressure sensor' },
  P1108: { description: 'Barometric Pressure Circuit High Input', severity: 'Warning', cause: 'High BARO signal', fix: 'Replace barometric pressure sensor' },
  P1128: { description: 'MAP Value Lower Than Expected', severity: 'Warning', cause: 'Vacuum leak or MAP sensor issue', fix: 'Check for vacuum leaks and MAP sensor' },
  P1129: { description: 'MAP Value Higher Than Expected', severity: 'Warning', cause: 'Restricted intake or MAP sensor issue', fix: 'Check intake system and MAP sensor' },
  P1149: { description: 'Primary Heated O2 Sensor Circuit Range/Performance', severity: 'Warning', cause: 'O2 sensor out of range', fix: 'Replace primary O2 sensor' },
  P1157: { description: 'Air/Fuel Ratio Sensor Circuit Low Voltage', severity: 'Warning', cause: 'A/F sensor low voltage', fix: 'Replace air/fuel ratio sensor' },
  P1159: { description: 'Air/Fuel Ratio Sensor Circuit High Voltage', severity: 'Warning', cause: 'A/F sensor high voltage', fix: 'Replace air/fuel ratio sensor' },
  P1162: { description: 'Air/Fuel Ratio Sensor Circuit Slow Response', severity: 'Warning', cause: 'Slow A/F sensor', fix: 'Replace air/fuel ratio sensor' },
  P1253: { description: 'VTEC System Malfunction', severity: 'Critical', cause: 'VTEC solenoid or oil pressure issue', fix: 'Check VTEC solenoid and engine oil level' },
  P1259: { description: 'VTEC System Malfunction (Electric)', severity: 'Critical', cause: 'VTEC solenoid electrical issue', fix: 'Check VTEC solenoid wiring and connector' },
  P1297: { description: 'Electrical Load Detector Circuit Low Input', severity: 'Info', cause: 'ELD sensor issue', fix: 'Check electrical load detector sensor' },
  P1298: { description: 'Electrical Load Detector Circuit High Input', severity: 'Info', cause: 'ELD sensor issue', fix: 'Check electrical load detector sensor' },
  P1300: { description: 'Random Misfire (Honda-specific)', severity: 'Critical', cause: 'Multiple misfires detected', fix: 'Check spark plugs, coils, fuel system' },
  P1336: { description: 'Crankshaft Speed Fluctuation Sensor Intermittent', severity: 'Warning', cause: 'CKP sensor intermittent signal', fix: 'Check CKP sensor connections' },
  P1337: { description: 'Crankshaft Speed Fluctuation Sensor No Signal', severity: 'Critical', cause: 'No CKP sensor signal', fix: 'Replace crankshaft position sensor' },
  P1361: { description: 'Top Dead Center Sensor Intermittent', severity: 'Warning', cause: 'TDC sensor intermittent signal', fix: 'Check TDC sensor connections' },
  P1362: { description: 'Top Dead Center Sensor No Signal', severity: 'Critical', cause: 'No TDC sensor signal', fix: 'Replace TDC sensor' },
  P1381: { description: 'Camshaft Position Sensor Intermittent', severity: 'Warning', cause: 'CMP sensor intermittent signal', fix: 'Check CMP sensor connections' },
  P1382: { description: 'Camshaft Position Sensor No Signal', severity: 'Critical', cause: 'No CMP sensor signal', fix: 'Replace camshaft position sensor' },
  P1456: { description: 'EVAP Emission Control System Leak Detected (Fuel Tank)', severity: 'Info', cause: 'Fuel tank EVAP leak', fix: 'Check gas cap, fuel tank, and EVAP lines' },
  P1457: { description: 'EVAP Emission Control System Leak Detected (Canister)', severity: 'Info', cause: 'EVAP canister leak', fix: 'Check EVAP canister and connections' },
  P1491: { description: 'EGR Valve Lift Insufficient Detected', severity: 'Warning', cause: 'EGR valve stuck or clogged', fix: 'Clean or replace EGR valve' },
  P1508: { description: 'Idle Air Control Valve Circuit Failure', severity: 'Warning', cause: 'IAC valve circuit issue', fix: 'Check IAC valve and wiring' },
  P1509: { description: 'Idle Air Control Valve Circuit Failure', severity: 'Warning', cause: 'IAC valve circuit issue', fix: 'Check IAC valve and wiring' },
  P1519: { description: 'Idle Air Control Valve Circuit Failure', severity: 'Warning', cause: 'IAC valve circuit issue', fix: 'Check IAC valve and wiring' },
  P1607: { description: 'ECM/PCM Internal Circuit Malfunction', severity: 'Critical', cause: 'ECU internal failure', fix: 'May require ECU replacement' },
  P1705: { description: 'AT Gear Position Switch Short Circuit', severity: 'Warning', cause: 'Gear position switch issue', fix: 'Check gear position switch and wiring' },
  P1706: { description: 'AT Gear Position Switch Open Circuit', severity: 'Warning', cause: 'Gear position switch open', fix: 'Check gear position switch and wiring' },
  P1739: { description: 'Transmission 3rd Pressure Switch', severity: 'Warning', cause: 'Transmission pressure switch issue', fix: 'Check transmission pressure switch' },
  P1768: { description: 'AT Clutch Pressure Control Solenoid Valve A', severity: 'Warning', cause: 'Transmission solenoid issue', fix: 'Check transmission solenoid valve' },
};

/**
 * Look up fault code information
 * @param {string} code - The fault code (e.g., 'P0301')
 * @param {string} brand - Vehicle brand ('Toyota', 'Nissan', 'Honda', or null for generic)
 * @returns {{ code, description, severity, cause, fix, brand }}
 */
export function getCodeInfo(code, brand = null) {
  const upperCode = code.toUpperCase();

  // Check brand-specific codes first (P1xxx range)
  if (brand) {
    const brandLower = brand.toLowerCase();
    let brandDB = null;

    if (brandLower === 'toyota') brandDB = TOYOTA_CODES;
    else if (brandLower === 'nissan') brandDB = NISSAN_CODES;
    else if (brandLower === 'honda') brandDB = HONDA_CODES;

    if (brandDB && brandDB[upperCode]) {
      return {
        code: upperCode,
        ...brandDB[upperCode],
        brand: brand,
      };
    }
  }

  // Check all brand databases for P1xxx codes
  if (upperCode.startsWith('P1')) {
    for (const [brandName, db] of [
      ['Toyota', TOYOTA_CODES],
      ['Nissan', NISSAN_CODES],
      ['Honda', HONDA_CODES],
    ]) {
      if (db[upperCode]) {
        return {
          code: upperCode,
          ...db[upperCode],
          brand: brandName,
        };
      }
    }
  }

  // Check standard codes
  if (STANDARD_CODES[upperCode]) {
    return {
      code: upperCode,
      ...STANDARD_CODES[upperCode],
      brand: 'Generic OBD-II',
    };
  }

  // Generate generic info for unknown codes
  const codeType = upperCode[0];
  const types = { P: 'Powertrain', C: 'Chassis', B: 'Body', U: 'Network' };

  return {
    code: upperCode,
    description: `${types[codeType] || 'Unknown'} Fault Code ${upperCode}`,
    severity: 'Warning',
    cause: 'Refer to vehicle service manual for specific diagnosis',
    fix: 'Consult a certified mechanic for diagnosis',
    brand: brand || 'Unknown',
  };
}

/**
 * Get all supported brands
 */
export function getSupportedBrands() {
  return ['Toyota', 'Nissan', 'Honda'];
}

/**
 * Get severity color
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'Critical': return '#DC2626';
    case 'Warning': return '#F59E0B';
    case 'Info': return '#10B981';
    default: return '#6B7280';
  }
}

export default {
  getCodeInfo,
  getSupportedBrands,
  getSeverityColor,
};
