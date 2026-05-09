// AutoSense Assistant — knowledge base
//
// The bot resolves a user message to one INTENT by keyword scoring, then
// the matching intent's `respond(ctx)` builds the reply using live app
// context (vehicle, OBD readings, DTCs, last inspection).
//
// To extend: add a new intent object, give it keywords, write a respond()
// that returns { text, suggestions? }.

// Common follow-up suggestions shown after most replies
const COMMON_SUGGESTIONS = [
  'Explain my fault codes',
  "Is my car healthy?",
  'When is my next service?',
  'Diesel care tips',
  'Fuel saving tips',
];

// Helper formatters
function fmt(v, decimals = 1) {
  if (v == null || isNaN(v)) return '—';
  return typeof v === 'number'
    ? (v % 1 === 0 ? v.toFixed(0) : v.toFixed(decimals))
    : String(v);
}
function vehicleLine(v) {
  if (!v) return 'your vehicle';
  return `${v.brand || ''} ${v.model || ''} ${v.vehicleNumber ? '(' + v.vehicleNumber + ')' : ''}`.trim()
    || 'your vehicle';
}

export const INTENTS = [
  // ─── Greeting ────────────────────────────────────────────────────────────
  {
    id: 'greeting',
    keywords: ['hi', 'hello', 'hey', 'good morning', 'good evening', 'good afternoon', 'helo', 'hii'],
    respond: ({ vehicle }) => ({
      text:
        `Hi 👋  I'm your AutoSense assistant.\n\n` +
        `I can help you understand ${vehicleLine(vehicle)}'s health, ` +
        `explain fault codes, and answer questions about your sensors.\n\n` +
        `Try one of the suggestions below, or ask me anything.`,
      suggestions: COMMON_SUGGESTIONS,
    }),
  },

  // ─── Follow-up: "more details", "explain more", "tell me more" ───────────
  // Uses conversation memory to resurface the last topic with extra context.
  {
    id: 'more_details',
    keywords: ['more', 'tell me more', 'explain more', 'details', 'elaborate', 'continue', 'go on'],
    respond: ({ lastIntentId, history, vehicle, faultCodes, ecuSnapshot }) => {
      // If we have a recent topic, reflect it back rather than pretending to be fresh
      const lastUserMsg = [...(history || [])].reverse().find(h => h.role === 'user');
      const topic = lastIntentId ? lastIntentId.replace(/_/g, ' ') : 'the previous topic';
      const tail = lastUserMsg ? `\n\nYour last question was: "${lastUserMsg.text}"` : '';
      return {
        text:
          `Sure — happy to dig deeper into ${topic}.${tail}\n\n` +
          `Tap a suggestion below to focus on a specific area, or ask a more targeted question (e.g. "what causes high coolant temp?").`,
        suggestions: ['Explain my fault codes', 'Diesel care tips', 'Brake check', 'Tire care'],
      };
    },
  },

  // ─── DTC / Fault codes ───────────────────────────────────────────────────
  {
    id: 'explain_dtc',
    keywords: ['dtc', 'fault', 'fault code', 'check engine', 'error code', 'p0', 'p1', 'trouble code', 'engine light'],
    respond: ({ faultCodes = [] }) => {
      if (!faultCodes.length) {
        return {
          text:
            `✅  No fault codes are currently stored.\n\n` +
            `If your check-engine light is on, scan again from the Fault Codes screen — sometimes codes take a moment to register.`,
          suggestions: ['Scan now', 'Sensor info', "Is my car healthy?"],
        };
      }
      const lines = faultCodes.slice(0, 5).map((f, i) =>
        `${i + 1}. ${f.code} — ${f.description}\n   Severity: ${f.severity || 'Unknown'}\n   Likely cause: ${f.cause || '—'}\n   Suggested action: ${f.fix || '—'}`
      );
      const more = faultCodes.length > 5 ? `\n\n…and ${faultCodes.length - 5} more in the Fault Codes screen.` : '';
      return {
        text: `I found ${faultCodes.length} fault code${faultCodes.length > 1 ? 's' : ''}:\n\n${lines.join('\n\n')}${more}`,
        suggestions: ['What should I do first?', 'Is this serious?', 'Cost to fix?'],
      };
    },
  },

  // ─── Specific code lookup (e.g. "what is P0420") ─────────────────────────
  {
    id: 'lookup_specific_code',
    // Matches messages containing a 5-char code like P0420, C1234, etc.
    test: (msg) => /\b[pcbu]\d{4}\b/i.test(msg),
    respond: ({ message }) => {
      const match = message.match(/\b([pcbu]\d{4})\b/i);
      const code = match ? match[1].toUpperCase() : null;
      // We don't import FaultCodeDatabase here to keep this module lightweight.
      // The AssistantService injects the lookup function via context.
      return {
        text: code
          ? `Looking up ${code}…  (use the Fault Codes screen for the full description, severity, cause and fix)`
          : `I couldn't find a fault code in your message. Try "explain my fault codes" instead.`,
        lookupCode: code, // signal AssistantService to enrich this reply
        suggestions: ['Explain my fault codes', "Is my car healthy?"],
      };
    },
  },

  // ─── Engine health summary ───────────────────────────────────────────────
  {
    id: 'health_summary',
    keywords: ['healthy', 'health', 'condition', 'overall', 'how is my car', 'status', 'good', 'ok'],
    respond: ({ vehicle, latestInspection, ecuSnapshot }) => {
      const parts = [];

      if (latestInspection) {
        const s = latestInspection.summary || {};
        const score = latestInspection.healthScore;
        const verdict = score >= 80 ? 'Good ✅' : score >= 60 ? 'Monitor ⚠️' : score != null ? 'Action Needed 🔻' : 'Not scored';
        const date = latestInspection.createdAt?.toDate
          ? latestInspection.createdAt.toDate().toLocaleDateString()
          : 'recently';
        parts.push(
          `Last inspection (${date}):\n` +
          `  • Engine health: ${score ?? '—'}/100 — ${verdict}\n` +
          `  • 🟢 ${s.green || 0} good   🟡 ${s.yellow || 0} monitor   🔴 ${s.red || 0} action`
        );
      } else {
        parts.push(
          `You haven't completed a Vehicle Inspection yet. Run one from Home → Inspection to get a health summary.`
        );
      }

      if (ecuSnapshot) {
        parts.push(
          `Live readings:\n` +
          `  • RPM: ${fmt(ecuSnapshot.rpm, 0)}\n` +
          `  • Coolant: ${fmt(ecuSnapshot.coolantTemp)}°C\n` +
          `  • Engine load: ${fmt(ecuSnapshot.engineLoad)}%\n` +
          `  • Battery: ${fmt(ecuSnapshot.voltage)}V`
        );
      }

      return {
        text: parts.join('\n\n'),
        suggestions: ['Explain my fault codes', 'Show recurring issues', 'When should I service?'],
      };
    },
  },

  // ─── Sensor education ────────────────────────────────────────────────────
  {
    id: 'explain_rpm',
    keywords: ['rpm', 'revolution', 'engine speed'],
    respond: ({ ecuSnapshot, vehicle }) => {
      const live = ecuSnapshot?.rpm != null ? `\n\nRight now your engine shows ${fmt(ecuSnapshot.rpm, 0)} RPM.` : '';
      return {
        text:
          `RPM (Revolutions Per Minute) measures how fast your engine spins.\n\n` +
          `Typical ranges:\n` +
          `  • Idle: 600 – 900 RPM (diesel) / 700 – 1000 (petrol)\n` +
          `  • Cruising: 1500 – 2500 RPM\n` +
          `  • Redline: usually 6000 – 7000 (engine-specific)\n` +
          `\nUnusually high idle suggests a vacuum leak, idle-air-control fault, or sticky throttle.${live}`,
        suggestions: ['Explain coolant temp', 'Explain engine load', "Is my car healthy?"],
      };
    },
  },
  {
    id: 'explain_coolant',
    keywords: ['coolant', 'overheat', 'overheating', 'temperature', 'engine temp', 'hot'],
    respond: ({ ecuSnapshot }) => {
      const live = ecuSnapshot?.coolantTemp != null
        ? `\n\nYour current coolant temp is ${fmt(ecuSnapshot.coolantTemp)}°C.` +
          (ecuSnapshot.coolantTemp > 105 ? ' ⚠️  This is high — pull over safely if it keeps rising.' :
           ecuSnapshot.coolantTemp > 95  ? ' Slightly elevated — keep an eye on it.' :
           ecuSnapshot.coolantTemp < 70  ? ' Engine may not be fully warmed up yet.' :
           ' Within normal operating range.')
        : '';
      return {
        text:
          `Coolant temperature shows how hot the engine is running.\n\n` +
          `Healthy range: 80 – 95 °C under normal driving.\n` +
          `Above 105 °C is overheating territory — common causes include:\n` +
          `  • Low coolant level\n` +
          `  • Faulty thermostat\n` +
          `  • Failed water pump\n` +
          `  • Blocked radiator${live}`,
        suggestions: ['Explain RPM', 'Engine overheating help', "Is my car healthy?"],
      };
    },
  },
  {
    id: 'explain_load',
    keywords: ['engine load', 'load', 'maf', 'mass air flow'],
    respond: ({ ecuSnapshot }) => {
      const live = ecuSnapshot?.engineLoad != null
        ? `\n\nYour current engine load is ${fmt(ecuSnapshot.engineLoad)}%.`
        : '';
      return {
        text:
          `Engine load is the percentage of maximum power the engine is producing.\n\n` +
          `Typical ranges:\n` +
          `  • Idle: 15 – 25%\n` +
          `  • Light cruising: 25 – 50%\n` +
          `  • Hard acceleration: 70 – 100%\n` +
          `\nUnexpectedly high idle load can indicate dragging brakes, worn engine, or accessories drawing too much power.${live}`,
        suggestions: ['Explain RPM', 'Explain coolant temp'],
      };
    },
  },
  {
    id: 'explain_battery',
    keywords: ['battery', 'voltage', 'volts', 'charging', 'alternator'],
    respond: ({ ecuSnapshot }) => {
      const v = ecuSnapshot?.voltage;
      let live = '';
      if (v != null) {
        live = `\n\nYour current battery voltage is ${fmt(v)}V.` +
          (v < 11.5 ? ' ⚠️  Low — battery may be discharged or alternator not charging.' :
           v > 15.0 ? ' ⚠️  High — possible voltage regulator issue.' :
           ' Within normal range.');
      }
      return {
        text:
          `Battery voltage tells you about your battery and charging system.\n\n` +
          `Healthy ranges:\n` +
          `  • Engine off: 12.4 – 12.7 V\n` +
          `  • Engine running: 13.7 – 14.7 V (alternator charging)\n` +
          `\nBelow 12 V engine-off = weak battery. Below 13 V engine-on = alternator not charging.${live}`,
        suggestions: ['Explain my fault codes', "Is my car healthy?"],
      };
    },
  },

  // ─── Live readings (current values) ──────────────────────────────────────
  {
    id: 'show_live',
    keywords: ['live', 'current reading', 'show data', 'show sensor', 'show reading', 'whats my', "what's my"],
    respond: ({ ecuSnapshot, obdConnected }) => {
      if (!obdConnected) {
        return {
          text:
            `I don't have live readings right now — your OBD-II adapter isn't connected.\n\n` +
            `Tap "Connect Device" on the Home screen to pair your ELM327 adapter, then ask me again.`,
          suggestions: ['How to connect?', "Is my car healthy?", 'Explain my fault codes'],
        };
      }
      if (!ecuSnapshot) {
        return {
          text: `Connected, but I haven't pulled any sensor data yet. Open the Dashboard or Inspection screen and tap "Pull from OBD".`,
          suggestions: ["Is my car healthy?"],
        };
      }
      return {
        text:
          `Latest live readings:\n` +
          `  • RPM: ${fmt(ecuSnapshot.rpm, 0)}\n` +
          `  • Speed: ${fmt(ecuSnapshot.speed, 0)} km/h\n` +
          `  • Coolant: ${fmt(ecuSnapshot.coolantTemp)}°C\n` +
          `  • Engine load: ${fmt(ecuSnapshot.engineLoad)}%\n` +
          `  • Throttle: ${fmt(ecuSnapshot.throttle)}%\n` +
          `  • Battery: ${fmt(ecuSnapshot.voltage)}V\n` +
          `  • Intake temp: ${fmt(ecuSnapshot.intakeTemp)}°C\n` +
          `  • MAF: ${fmt(ecuSnapshot.maf)} g/s`,
        suggestions: ['Explain RPM', 'Explain coolant temp', 'Explain engine load'],
      };
    },
  },

  // ─── Maintenance / service due — uses live schedule when available ───────
  {
    id: 'service_due',
    keywords: ['service', 'maintenance', 'when should i', 'oil change', 'overdue', 'due',
               'next service', 'service interval', 'service due'],
    respond: ({ latestInspection, maintenance }) => {
      // Prefer the user's actual maintenance schedule if it exists
      if (maintenance && maintenance.items && maintenance.items.length) {
        const overdue = maintenance.items.filter(i => i.status === 'overdue');
        const dueSoon = maintenance.items.filter(i => i.status === 'due_soon');
        const lines = [
          `📋  Your maintenance schedule (current: ${maintenance.currentMileage.toLocaleString()} km):`,
        ];
        if (overdue.length) {
          lines.push(`\n🔻 Overdue:`);
          overdue.slice(0, 4).forEach(i => {
            lines.push(`  • ${i.name} — overdue by ${Math.abs(i.kmUntilDue).toLocaleString()} km`);
          });
        }
        if (dueSoon.length) {
          lines.push(`\n🟡 Due soon:`);
          dueSoon.slice(0, 4).forEach(i => {
            lines.push(`  • ${i.name} — in ${i.kmUntilDue.toLocaleString()} km`);
          });
        }
        if (!overdue.length && !dueSoon.length) {
          const next = maintenance.items[0];
          lines.push(`\n🟢 Everything is up to date.`);
          if (next) {
            lines.push(`Next up: ${next.name} in ${next.kmUntilDue.toLocaleString()} km.`);
          }
        }
        lines.push(`\nTip: tap "Maintenance Schedule" under More Options to mark items as serviced.`);
        return {
          text: lines.join('\n'),
          suggestions: ['Show recurring issues', "Is my car healthy?", 'Fuel saving tips'],
          actions: [{ label: 'Open Schedule', screen: 'MaintenanceSchedule', icon: 'construct-outline' }],
        };
      }

      // No schedule yet — show the generic guidance plus a CTA to set one up
      const lines = [
        `Typical service intervals (based on standard manufacturer guidance):`,
        `  • Engine oil & filter: every 5,000 – 10,000 km`,
        `  • Engine air filter: every 15,000 – 30,000 km`,
        `  • Cabin air filter: every 15,000 – 25,000 km`,
        `  • Brake fluid: every 2 years`,
        `  • Coolant: every 40,000 km or 2 years`,
        `  • Transmission fluid: every 60,000 – 100,000 km`,
        `  • Spark plugs (petrol): every 30,000 – 100,000 km`,
        `  • Timing belt: every 90,000 – 100,000 km (if equipped)`,
      ];

      if (latestInspection) {
        const s = latestInspection.summary || {};
        if ((s.red || 0) > 0) {
          lines.push(`\n🔻 Your last inspection flagged ${s.red} item(s) for action — book a service soon.`);
        } else if ((s.yellow || 0) > 0) {
          lines.push(`\n🟡 Your last inspection flagged ${s.yellow} item(s) to monitor — plan a service in the next month or two.`);
        } else {
          lines.push(`\n🟢 No urgent items flagged in your last inspection. Stick to the regular intervals above.`);
        }
      }
      lines.push(`\n💡  Open Maintenance Schedule and run an inspection so I can give you personalised km-based advice.`);
      return {
        text: lines.join('\n'),
        suggestions: ['Show recurring issues', "Is my car healthy?", 'Fuel saving tips'],
        actions: [{ label: 'Open Schedule', screen: 'MaintenanceSchedule', icon: 'construct-outline' }],
      };
    },
  },

  // ─── Recurring issues ────────────────────────────────────────────────────
  {
    id: 'recurring',
    keywords: ['recurring', 'always', 'keeps', 'often', 'pattern', 'common problem', 'history'],
    respond: ({ inspections = [] }) => {
      if (inspections.length < 2) {
        return {
          text:
            `I need at least 2 inspections to spot recurring problems. ` +
            `You have ${inspections.length}.\n\n` +
            `Run another Vehicle Inspection from Home, then ask me again.`,
          suggestions: ["Is my car healthy?", 'When should I service?'],
        };
      }
      // Inline recurring computation (simplified)
      const counts = {};
      inspections.forEach(ins => {
        if (!ins.results) return;
        Object.entries(ins.results).forEach(([id, r]) => {
          if (r.status === 'red' || r.status === 'yellow') {
            counts[id] = counts[id] || { red: 0, yellow: 0, total: 0 };
            counts[id][r.status] += 1;
            counts[id].total += 1;
          }
        });
      });
      const top = Object.entries(counts)
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => (b.red - a.red) || (b.total - a.total))
        .slice(0, 5);

      if (top.length === 0) {
        return {
          text: `🎉 No items have been flagged repeatedly across your inspections. Nice job keeping the car healthy!`,
          suggestions: ["Is my car healthy?", 'When should I service?'],
        };
      }

      const lines = top.map((t, i) =>
        `${i + 1}. ${t.id} — flagged ${t.red > 0 ? `🔴×${t.red} ` : ''}${t.yellow > 0 ? `🟡×${t.yellow}` : ''}`
      );
      return {
        text:
          `Top recurring issues across your ${inspections.length} inspections:\n\n${lines.join('\n')}\n\n` +
          `Open the Vehicle Analysis screen for the full breakdown.`,
        suggestions: ["Is my car healthy?", 'When should I service?'],
      };
    },
  },

  // ─── Fuel-saving tips ────────────────────────────────────────────────────
  {
    id: 'fuel_tips',
    keywords: ['fuel', 'save fuel', 'fuel saving', 'mileage', 'economy', 'mpg', 'kml', 'efficiency'],
    respond: () => ({
      text:
        `Practical fuel-saving tips:\n\n` +
        `  1. Keep tires at correct pressure (under-inflated tires waste 3-5%)\n` +
        `  2. Smooth acceleration and braking — avoid stop-go driving\n` +
        `  3. Don't idle for more than 30 seconds — restart instead\n` +
        `  4. Remove roof racks and unnecessary weight\n` +
        `  5. Service the air filter — a dirty filter cuts efficiency\n` +
        `  6. Use the highest gear that's comfortable (lower RPM = less fuel)\n` +
        `  7. A/C above 80 km/h is more efficient than open windows\n` +
        `  8. Plan trips to combine errands — cold engines burn more fuel`,
      suggestions: ['When should I service?', "Is my car healthy?"],
    }),
  },

  // ─── Connection / Bluetooth help ─────────────────────────────────────────
  {
    id: 'connection_help',
    keywords: ['connect', 'bluetooth', 'pair', 'elm327', 'adapter', 'not connecting', 'bt'],
    respond: () => ({
      text:
        `To connect your ELM327 OBD-II adapter:\n\n` +
        `  1. Plug the adapter into your vehicle's OBD-II port (usually under the dashboard near the steering column).\n` +
        `  2. Turn the ignition ON (engine running is fine).\n` +
        `  3. On your phone: Settings → Bluetooth → Pair the ELM327 (PIN is usually 1234 or 0000).\n` +
        `  4. Open AutoSense → Home → Connect Device → pick the adapter.\n` +
        `\nCommon issues:\n` +
        `  • Weak adapter? Try a different one — many cheap clones don't follow ELM327 properly.\n` +
        `  • Connected but no data? Make sure the ignition is ON.\n` +
        `  • Disconnects often? Try moving the phone closer.`,
      suggestions: ["Is my car healthy?", 'Explain my fault codes'],
    }),
  },

  // ─── Specific symptom: overheating ───────────────────────────────────────
  {
    id: 'overheating',
    keywords: ['overheat', 'overheating', 'engine hot', 'running hot', 'temperature gauge'],
    respond: ({ ecuSnapshot }) => {
      const live = ecuSnapshot?.coolantTemp != null
        ? `\n\nYour current coolant temp is ${fmt(ecuSnapshot.coolantTemp)}°C.`
        : '';
      return {
        text:
          `If your engine is overheating, do this immediately:\n\n` +
          `  1. Pull over safely and turn the engine off.\n` +
          `  2. Open the bonnet (hood) carefully — steam can burn.\n` +
          `  3. Wait 20+ minutes before opening the radiator cap (boiling coolant can spray).\n` +
          `  4. Check coolant level — if low, top up with water (or coolant) once cool.\n` +
          `  5. Check for visible leaks under the car.\n\n` +
          `Common causes: low coolant, broken thermostat, failed water pump, blocked radiator, faulty cooling fan.${live}`,
        suggestions: ['Explain coolant temp', 'Explain my fault codes', 'When should I service?'],
      };
    },
  },

  // ─── Diesel / 1KD / DPF / EGR / glow plugs ───────────────────────────────
  {
    id: 'diesel_care',
    keywords: ['diesel', 'dpf', 'egr', 'glow plug', 'soot', 'particulate', 'turbo', 'vnt', 'regeneration', '1kd', '2kd'],
    respond: ({ vehicle }) => {
      const isDiesel = (vehicle?.engineType || '').toLowerCase().includes('diesel');
      const intro = isDiesel
        ? `Your ${vehicleLine(vehicle)} is a diesel — here's how to keep the engine and exhaust system healthy:`
        : `Diesel-specific maintenance tips:`;
      return {
        text:
          `${intro}\n\n` +
          `🔥  DPF (Diesel Particulate Filter):\n` +
          `  • Drive 20+ minutes at 80+ km/h every 2 weeks to allow regeneration\n` +
          `  • Avoid only short city trips — they clog the DPF with soot\n` +
          `  • Use the correct low-ash oil (ACEA C2 or C3)\n\n` +
          `💨  EGR Valve:\n` +
          `  • Carbon build-up causes rough idle and power loss\n` +
          `  • Italian tune-up: a long highway run can help clear deposits\n` +
          `  • Persistent EGR fault codes mean it needs cleaning or replacement\n\n` +
          `⚡  Glow Plugs:\n` +
          `  • Hard cold starts = first sign of failing glow plugs\n` +
          `  • Replace as a set every 80,000 – 100,000 km\n\n` +
          `🌪  Turbo (VNT on 1KD):\n` +
          `  • Don't rev or shut off immediately after hard driving — let it cool 30s\n` +
          `  • Loss of boost or whistling = sticky vanes (clean or rebuild)\n\n` +
          `⛽  Fuel:\n` +
          `  • Use clean diesel from busy stations (less water/sediment)\n` +
          `  • Replace fuel filter at the recommended interval — water in fuel destroys injectors`,
        suggestions: ['When should I service?', 'Explain my fault codes', "Is my car healthy?"],
      };
    },
  },

  // ─── A/C and climate ─────────────────────────────────────────────────────
  {
    id: 'ac_climate',
    keywords: ['ac', 'a/c', 'air condition', 'aircon', 'cooling', 'cold air', 'climate', 'compressor', 'refrigerant', 'gas refill'],
    respond: () => ({
      text:
        `A/C and climate system tips:\n\n` +
        `❄️  If A/C blows warm:\n` +
        `  • Low refrigerant (gas) is most common — needs a recharge\n` +
        `  • Failed compressor clutch — listen for it engaging when A/C is on\n` +
        `  • Blocked condenser (in front of radiator) — clean of debris\n` +
        `  • Cabin filter clogged — restricts airflow\n\n` +
        `💧  If A/C smells musty:\n` +
        `  • Mould in evaporator — run A/C off + fan on for last 5 mins of trip to dry it\n` +
        `  • Replace cabin filter every 15,000 – 25,000 km\n\n` +
        `📋  Maintenance:\n` +
        `  • Full A/C service every 2 years (vacuum, refrigerant, oil)\n` +
        `  • Run A/C 10 minutes weekly even in winter — keeps seals lubricated\n` +
        `  • If you hear hissing or see oily residue near A/C lines, get it inspected immediately`,
      suggestions: ['When should I service?', 'Explain my fault codes'],
    }),
  },

  // ─── Brakes ──────────────────────────────────────────────────────────────
  {
    id: 'brakes',
    keywords: ['brake', 'braking', 'pad', 'rotor', 'disc', 'squeal', 'grinding', 'soft pedal', 'spongy', 'abs'],
    respond: () => ({
      text:
        `Brake system guidance:\n\n` +
        `🚨  Warning signs that need immediate attention:\n` +
        `  • Squealing → pads worn close to the wear indicator (replace soon)\n` +
        `  • Grinding → metal-on-metal, pads gone — STOP DRIVING\n` +
        `  • Soft / spongy pedal → air in lines or fluid leak — check before driving\n` +
        `  • Pulling to one side → uneven wear or sticky caliper\n` +
        `  • Vibration through pedal → warped rotors\n\n` +
        `📋  Service intervals:\n` +
        `  • Brake pads: typically 30,000 – 60,000 km (depends on driving style)\n` +
        `  • Rotors: replace or resurface every 2nd pad change\n` +
        `  • Brake fluid: flush every 2 years (it absorbs water and degrades)\n\n` +
        `💡  Habits that extend brake life:\n` +
        `  • Anticipate stops — coast instead of brake-and-go\n` +
        `  • Use engine braking on long descents\n` +
        `  • Don't ride the brake pedal`,
      suggestions: ['When should I service?', 'Explain my fault codes', "Is my car healthy?"],
    }),
  },

  // ─── Tires ───────────────────────────────────────────────────────────────
  {
    id: 'tires',
    keywords: ['tire', 'tyre', 'tread', 'pressure', 'psi', 'rotation', 'alignment', 'flat', 'puncture', 'wheel'],
    respond: () => ({
      text:
        `Tire care fundamentals:\n\n` +
        `📏  Pressure:\n` +
        `  • Check monthly when cold (before driving)\n` +
        `  • Use the placard inside driver's door, not the sidewall number\n` +
        `  • Under-inflated = poor mileage + uneven wear + blowout risk\n` +
        `  • Over-inflated = harsh ride + centre wear + reduced grip\n\n` +
        `🔄  Rotation:\n` +
        `  • Every 10,000 km — equalises wear front-to-rear\n` +
        `  • Skipping rotation can halve your tire life\n\n` +
        `📐  Alignment:\n` +
        `  • Check yearly, or any time you hit a bad pothole/curb\n` +
        `  • Symptoms: pulls to one side, off-centre steering wheel, uneven wear\n\n` +
        `👀  Tread depth:\n` +
        `  • Replace at 1.6 mm (legal min) — but 3 mm is safer in wet\n` +
        `  • Coin test: insert a coin into the groove; if you see the rim, time to replace\n\n` +
        `⚠️  Ageing:\n` +
        `  • Even with good tread, replace tires older than 6 years (rubber hardens)\n` +
        `  • DOT code on sidewall: last 4 digits = week/year of manufacture`,
      suggestions: ['When should I service?', 'Fuel saving tips'],
    }),
  },

  // ─── Cold start / hard starting ──────────────────────────────────────────
  {
    id: 'cold_start',
    keywords: ['cold start', 'hard start', 'won\'t start', 'wont start', 'slow start', 'cranking', 'starting issue', 'morning start'],
    respond: ({ vehicle }) => {
      const isDiesel = (vehicle?.engineType || '').toLowerCase().includes('diesel');
      return {
        text:
          `Hard starting troubleshooting:\n\n` +
          `🔋  Battery first:\n` +
          `  • If cranking is slow/sluggish → battery weak (check voltage when off, should be 12.4-12.7V)\n` +
          `  • Clean corroded terminals\n` +
          `  • Battery older than 4 years? Have it load-tested\n\n` +
          (isDiesel
            ? `⚡  Diesel-specific:\n` +
              `  • Glow plugs are the #1 cause of hard cold starts\n` +
              `  • Wait for the glow-plug light to go out before cranking\n` +
              `  • Air in fuel lines (after a fuel filter change) — bleed before starting\n` +
              `  • Low compression = white smoke + hard start when cold\n\n`
            : `⚡  Petrol-specific:\n` +
              `  • Worn spark plugs — check at 30,000 km intervals\n` +
              `  • Failing fuel pump → no fuel pressure during cranking\n` +
              `  • Faulty crank position sensor → intermittent no-start\n\n`) +
          `🔧  Other common causes:\n` +
          `  • Starter motor solenoid clicking but no crank\n` +
          `  • Failing ignition switch\n` +
          `  • Empty/contaminated fuel\n\n` +
          `Run a fault code scan first — it usually points right to the cause.`,
        suggestions: ['Explain my fault codes', 'Explain battery', 'When should I service?'],
      };
    },
  },

  // ─── App help / what can you do ──────────────────────────────────────────
  {
    id: 'help',
    keywords: ['help', 'what can you do', 'commands', 'menu', 'options', 'how to use', 'about'],
    respond: () => ({
      text:
        `I can help with:\n\n` +
        `  • Explaining your active fault codes (DTCs)\n` +
        `  • Vehicle health summary from your last inspection\n` +
        `  • Live OBD sensor readings (when connected)\n` +
        `  • Sensor education (RPM, coolant, engine load, battery, MAF)\n` +
        `  • Recurring issues across past inspections\n` +
        `  • Personalised maintenance schedule (km-based)\n` +
        `  • Diesel / DPF / EGR / 1KD-specific care\n` +
        `  • Brake, tire, A/C, and cold-start guidance\n` +
        `  • Fuel-saving tips\n` +
        `  • Bluetooth/ELM327 connection help\n\n` +
        `Type a question or tap a suggestion below.`,
      suggestions: COMMON_SUGGESTIONS,
    }),
  },

  // ─── Thanks / goodbye ────────────────────────────────────────────────────
  {
    id: 'thanks',
    keywords: ['thanks', 'thank you', 'thx', 'ty', 'appreciated', 'great', 'cool'],
    respond: () => ({
      text: `You're welcome! 🚗  Drive safely. Ask me anything anytime.`,
      suggestions: COMMON_SUGGESTIONS,
    }),
  },
];

// ─── Fallback when no intent matches ─────────────────────────────────────────
export const FALLBACK = {
  text:
    `I'm not sure I understood that. Try one of these:\n\n` +
    `  • "Explain my fault codes"\n` +
    `  • "Is my car healthy?"\n` +
    `  • "What's my coolant temp?"\n` +
    `  • "When should I service?"\n` +
    `  • "How do I connect my OBD adapter?"\n\n` +
    `Or type "help" to see everything I can do.`,
  suggestions: COMMON_SUGGESTIONS,
};

export const WELCOME_SUGGESTIONS = COMMON_SUGGESTIONS;
