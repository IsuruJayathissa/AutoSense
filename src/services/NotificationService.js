import { Alert } from 'react-native';

/**
 * NotificationService
 *
 * Currently uses React Native Alert for in-app notifications (works everywhere).
 * To enable true background push notifications, run:
 *   npx expo run:android
 * then swap the Alert calls below for expo-notifications equivalents.
 */

class NotificationService {
  constructor() {
    this._granted = true; // Alert needs no permission
  }

  // No-op: permissions not needed for Alert-based notifications
  async requestPermissions() {
    return true;
  }

  // Show an in-app alert — safe on all runtimes including Expo Go
  _showAlert(title, body) {
    Alert.alert(title, body, [{ text: 'OK' }], { cancelable: true });
  }

  async sendCriticalAlert(confidence = null) {
    const confText = confidence ? ` (${confidence}% confidence)` : '';
    this._showAlert(
      '⚠️ Critical Engine Alert',
      `AutoSense AI detected a critical anomaly${confText}. Inspect your vehicle immediately.`
    );
  }

  async sendWarningAlert(confidence = null) {
    const confText = confidence ? ` (${confidence}% confidence)` : '';
    this._showAlert(
      '🟡 Engine Warning',
      `AutoSense AI detected a potential issue${confText}. Monitor your vehicle closely.`
    );
  }

  async sendFaultCodeAlert(codes = []) {
    const count   = codes.length;
    const preview = codes.slice(0, 3).join(', ') + (count > 3 ? '…' : '');
    this._showAlert(
      `🔴 ${count} Fault Code${count !== 1 ? 's' : ''} Detected`,
      `DTC${count !== 1 ? 's' : ''}: ${preview}. Check the Fault Codes screen.`
    );
  }

  async sendReconnectedAlert(deviceName) {
    this._showAlert('🔗 OBD Reconnected', `AutoSense reconnected to ${deviceName}.`);
  }

  async sendDisconnectedAlert() {
    this._showAlert('📡 OBD Connection Lost', 'Please reconnect your OBD device manually.');
  }
}

export default new NotificationService();
