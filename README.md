# 🚗 AutoSense — Smart Vehicle Diagnostic

A cross-platform mobile application built with **React Native** and **Expo** that connects to vehicles via **Bluetooth OBD-II** adapters to provide real-time diagnostics, fault code analysis, and maintenance insights for **Toyota**, **Nissan**, and **Honda** vehicles.

---

## ✨ Features

- **Real-Time OBD-II Data** — Live sensor readings (RPM, temperature, speed, fuel level, etc.) via Bluetooth
- **Fault Code Diagnostics** — Read, interpret, and clear OBD-II Diagnostic Trouble Codes (DTCs)
- **Engine Health Analysis** — Visual engine health assessment and scoring
- **Data Charts & Graphs** — Interactive line charts for RPM, temperature trends, and fuel consumption
- **Maintenance Scheduler** — Track and schedule vehicle maintenance based on diagnostics
- **Vehicle Inspection** — Comprehensive vehicle inspection checklists with detailed reports
- **AI Assistant** — Intelligent assistant for diagnostic guidance and troubleshooting
- **Report Generation** — Export diagnostic reports as PDF
- **Diagnostic History** — View past diagnostic sessions and track changes over time
- **Multi-Vehicle Support** — Register and manage multiple vehicles
- **Admin Panel** — Manage vehicles, fault codes, and system settings
- **Push Notifications** — Alerts for maintenance reminders and critical diagnostics

---

## 🛠️ Tech Stack

| Layer            | Technology                                           |
| ---------------- | ---------------------------------------------------- |
| **Framework**    | React Native 0.81 + Expo SDK 54                     |
| **Navigation**   | React Navigation (Stack)                             |
| **Backend**      | Firebase (Auth, Firestore)                           |
| **Bluetooth**    | react-native-ble-plx / react-native-ble-manager     |
| **Charts**       | react-native-chart-kit + react-native-svg            |
| **Storage**      | AsyncStorage                                         |
| **HTTP**         | Axios                                                |
| **Animations**   | React Native Reanimated                              |

---

## 📁 Project Structure

```
SmartVehicleDiagnostic/
├── App.js                     # App entry point
├── app.json                   # Expo configuration
├── package.json               # Dependencies & scripts
├── assets/                    # Logo, splash screen images
├── src/
│   ├── config/                # Firebase & admin configuration
│   ├── data/                  # Static data files
│   ├── navigation/
│   │   └── AppNavigator.js    # Stack-based navigation
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── HomeScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── OBDConnectionScreen.js
│   │   ├── FaultCodesScreen.js
│   │   ├── EngineHealthScreen.js
│   │   ├── DataChartsScreen.js
│   │   ├── DataCollectionScreen.js
│   │   ├── AnalysisScreen.js
│   │   ├── HistoryScreen.js
│   │   ├── InspectionScreen.js
│   │   ├── InspectionDetailScreen.js
│   │   ├── MaintenanceScheduleScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── AssistantScreen.js
│   │   ├── VehicleAuthScreen.js
│   │   └── AdminScreen.js
│   ├── services/
│   │   ├── OBDService.js              # Bluetooth OBD-II communication
│   │   ├── FaultCodeDatabase.js       # DTC definitions & lookup
│   │   ├── AssistantService.js        # AI assistant logic
│   │   ├── DataCollectorService.js    # Sensor data collection
│   │   ├── InspectionService.js       # Vehicle inspection logic
│   │   ├── MaintenanceService.js      # Maintenance scheduling
│   │   ├── ReportService.js           # PDF report generation
│   │   ├── NotificationService.js     # Push notifications
│   │   ├── AdminFaultCodeService.js   # Admin fault code management
│   │   └── AdminVehicleService.js     # Admin vehicle management
│   └── utils/                 # Utility functions
└── android/                   # Native Android project
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio (for Android development)
- A physical device with Bluetooth (OBD-II features require a real device)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/IsuruJayathissa/AutoSense.git
   cd SmartVehicleDiagnostic
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run on Android** (requires a device or emulator)

   ```bash
   npx expo run:android
   ```

4. **Run on iOS** (macOS only)

   ```bash
   npx expo run:ios
   ```

> [!NOTE]
> Full OBD-II Bluetooth functionality and PDF export require a **development build** (`expo run:android`). Running in Expo Go will have limited native module support.

---

## 🔧 Configuration

### Firebase

Firebase is pre-configured in `src/config/firebase.js`. To use your own Firebase project:

1. Create a project in [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** (Email/Password) and **Cloud Firestore**
3. Replace the config object in `src/config/firebase.js` with your own credentials
4. Place your `google-services.json` in the project root for Android

---

## 📱 Supported Vehicles

| Brand    | OBD-II Protocol Support |
| -------- | ----------------------- |
| Toyota   | ✅                      |
| Nissan   | ✅                      |
| Honda    | ✅                      |

---

## 🧪 Scripts

| Command                    | Description                  |
| -------------------------- | ---------------------------- |
| `npx expo run:android`     | Build & run on Android       |
| `npx expo run:ios`         | Build & run on iOS           |
| `npm install`              | Install all dependencies     |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Isuru Jayathissa**

- GitHub: [@IsuruJayathissa](https://github.com/IsuruJayathissa)
