// Vehicle Inspection Checklist — Multi-Point Inspection (MPI) template.
// Status values: 'green' | 'yellow' | 'red' | 'na'
//
// To extend: add an item object { id, label, hint? } to any section.
// 'id' must be unique across the whole checklist (used as the Firestore key).

export const INSPECTION_SECTIONS = [
  {
    id: 'fluids',
    title: 'Fluids & Engine Bay',
    icon: 'water-outline',
    items: [
      { id: 'engine_oil',       label: 'Engine Oil Level & Condition' },
      { id: 'coolant',          label: 'Coolant Level & Condition' },
      { id: 'brake_fluid',      label: 'Brake Fluid Level' },
      { id: 'transmission',     label: 'Transmission Fluid' },
      { id: 'power_steering',   label: 'Power Steering Fluid' },
      { id: 'washer_fluid',     label: 'Windshield Washer Fluid' },
      { id: 'air_filter',       label: 'Engine Air Filter' },
      { id: 'cabin_filter',     label: 'Cabin Air Filter' },
      { id: 'drive_belts',      label: 'Drive Belts (cracks / wear)' },
      { id: 'hoses',            label: 'Hoses (leaks / swelling)' },
      { id: 'battery_visual',   label: 'Battery Terminals (corrosion)' },
    ],
  },
  {
    id: 'undercar',
    title: 'Under-Vehicle Components',
    icon: 'construct-outline',
    items: [
      { id: 'brake_pads_front',  label: 'Front Brake Pad Thickness' },
      { id: 'brake_pads_rear',   label: 'Rear Brake Pad Thickness' },
      { id: 'rotors',            label: 'Brake Rotors / Discs' },
      { id: 'calipers',          label: 'Brake Calipers' },
      { id: 'brake_lines',       label: 'Brake Lines & Hoses' },
      { id: 'shocks_struts',     label: 'Shocks / Struts' },
      { id: 'ball_joints',       label: 'Ball Joints' },
      { id: 'tie_rods',          label: 'Tie Rods & Bushings' },
      { id: 'exhaust',           label: 'Exhaust System (leaks / rust)' },
      { id: 'cv_boots',          label: 'CV Boots / Drive Axles' },
      { id: 'transmission_leak', label: 'Transmission Leaks' },
    ],
  },
  {
    id: 'tires',
    title: 'Tires & Wheels',
    icon: 'disc-outline',
    items: [
      { id: 'tire_fl_tread',     label: 'Front Left — Tread Depth' },
      { id: 'tire_fr_tread',     label: 'Front Right — Tread Depth' },
      { id: 'tire_rl_tread',     label: 'Rear Left — Tread Depth' },
      { id: 'tire_rr_tread',     label: 'Rear Right — Tread Depth' },
      { id: 'tire_spare',        label: 'Spare Tire Condition' },
      { id: 'tire_pressure',     label: 'Tire Pressure (all four)' },
      { id: 'tire_wear',         label: 'Uneven Wear / Sidewall Cracks' },
    ],
  },
  {
    id: 'exterior',
    title: 'Exterior & Safety Features',
    icon: 'sunny-outline',
    items: [
      { id: 'headlights',        label: 'Headlights (high & low beam)' },
      { id: 'brake_lights',      label: 'Brake Lights' },
      { id: 'turn_signals',      label: 'Turn Signals' },
      { id: 'hazard_lights',     label: 'Hazard Lights' },
      { id: 'reverse_lights',    label: 'Reverse Lights' },
      { id: 'windshield',        label: 'Windshield (cracks / chips)' },
      { id: 'wipers',            label: 'Wiper Blades' },
      { id: 'body_condition',    label: 'Body (rust / dents / paint)' },
    ],
  },
  {
    id: 'interior',
    title: 'Interior & Electronics',
    icon: 'car-sport-outline',
    items: [
      { id: 'horn',              label: 'Horn' },
      { id: 'hvac',              label: 'HVAC (Heating & A/C)' },
      { id: 'dashboard_lights',  label: 'Dashboard Warning Lights' },
      { id: 'seat_belts',        label: 'Seat Belts (all positions)' },
      { id: 'airbag_indicator',  label: 'Airbag Readiness Indicator' },
      { id: 'windows',           label: 'Power Windows' },
      { id: 'locks',             label: 'Door Locks (central locking)' },
      { id: 'mirrors',           label: 'Mirrors (manual / power)' },
    ],
  },
];

// ECU section is generated dynamically from live OBD data and engine health
// scoring — this is the master list of fields the report will display.
export const ECU_REPORT_FIELDS = [
  { id: 'rpm',          label: 'Engine RPM',          unit: ''      },
  { id: 'speed',        label: 'Vehicle Speed',       unit: ' km/h' },
  { id: 'coolantTemp',  label: 'Coolant Temperature', unit: '°C'    },
  { id: 'engineLoad',   label: 'Engine Load',         unit: '%'     },
  { id: 'throttle',     label: 'Throttle Position',   unit: '%'     },
  { id: 'voltage',      label: 'Battery Voltage',     unit: 'V'     },
  { id: 'fuelLevel',    label: 'Fuel Level',          unit: '%'     },
  { id: 'intakeTemp',   label: 'Intake Air Temp',     unit: '°C'    },
  { id: 'maf',          label: 'MAF Airflow',         unit: ' g/s'  },
  { id: 'timing',       label: 'Ignition Timing',     unit: '°'     },
];

// Helper — build a fresh empty result map (every item starts as 'na' / no notes)
export function buildEmptyResults() {
  const results = {};
  INSPECTION_SECTIONS.forEach((section) => {
    section.items.forEach((item) => {
      results[item.id] = { status: 'na', notes: '' };
    });
  });
  return results;
}

// Helper — count green / yellow / red / na across a results map
export function summarizeResults(results) {
  const summary = { green: 0, yellow: 0, red: 0, na: 0, total: 0 };
  Object.values(results || {}).forEach((r) => {
    if (summary[r.status] != null) summary[r.status] += 1;
    summary.total += 1;
  });
  return summary;
}

export const STATUS_META = {
  green:  { label: 'Good',          color: '#10B981', icon: 'checkmark-circle' },
  yellow: { label: 'Monitor',       color: '#F59E0B', icon: 'alert-circle'     },
  red:    { label: 'Action Needed', color: '#DC2626', icon: 'close-circle'     },
  na:     { label: 'Not Inspected', color: '#9CA3AF', icon: 'remove-circle'    },
};
