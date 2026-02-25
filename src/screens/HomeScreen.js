import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator
} from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export default function HomeScreen({ navigation }) {
  const [vehicleData, setVehicleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVehicleData();
  }, []);

  const loadVehicleData = async () => {
    try {
      console.log('Loading vehicle data...');
      console.log('User ID:', auth.currentUser?.uid);
      
      const userId = auth.currentUser.uid;
      const userVehicleDoc = await getDoc(doc(db, 'userVehicles', userId));
      
      console.log('UserVehicle exists:', userVehicleDoc.exists());
      
      if (userVehicleDoc.exists()) {
        const vehicleId = userVehicleDoc.data().vehicleId;
        console.log('Vehicle ID:', vehicleId);
        
        const vehicleDoc = await getDoc(doc(db, 'vehicles', vehicleId));
        console.log('Vehicle exists:', vehicleDoc.exists());
        
        if (vehicleDoc.exists()) {
          const data = vehicleDoc.data();
          console.log('Vehicle data:', data);
          setVehicleData(data);
        } else {
          console.log('No vehicle document found');
        }
      } else {
        console.log('No userVehicle document found');
      }
    } catch (error) {
      console.error('Error loading vehicle:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
    } finally {
      setLoading(false);
    }
  
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const menuItems = [
    {
      id: '1',
      icon: '📊',
      title: 'Real-time Data',
      subtitle: 'View live sensor data',
      screen: 'Dashboard',
      color: '#007AFF'
    },
    {
      id: '2',
      icon: '🔍',
      title: 'Scan for Faults',
      subtitle: 'Read diagnostic codes',
      screen: 'FaultCodes',
      color: '#FF3B30'
    },
    {
      id: '3',
      icon: '❤️',
      title: 'Engine Health',
      subtitle: 'Check engine status',
      screen: 'EngineHealth',
      color: '#34C759'
    },
    {
      id: '4',
      icon: '📜',
      title: 'History',
      subtitle: 'View past diagnostics',
      screen: 'History',
      color: '#FF9500'
    },
    {
      id: '5',
      icon: '🔧',
      title: 'Maintenance',
      subtitle: 'Service reminders',
      screen: 'History',
      color: '#5856D6'
    },
    {
      id: '6',
      icon: '⚙️',
      title: 'Settings',
      subtitle: 'App preferences',
      screen: 'Settings', 
      color: '#636366'
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚗 Smart Vehicle Diagnostic</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Vehicle Info Card */}
        {loading ? (
          <View style={styles.welcomeCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading vehicle info...</Text>
          </View>
        ) : vehicleData ? (
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleHeader}>
              <Text style={styles.vehicleIcon}>🚗</Text>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleNumber}>{vehicleData.vehicleNumber}</Text>
                <Text style={styles.vehicleModel}>
                  {vehicleData.brand} {vehicleData.model}
                </Text>
              </View>
            </View>
            <View style={styles.vehicleDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Year</Text>
                <Text style={styles.detailValue}>{vehicleData.year}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Engine</Text>
                <Text style={styles.detailValue}>{vehicleData.engineType}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, styles.statusActive]}>● Active</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeText}>👋 Welcome!</Text>
            <Text style={styles.emailText}>Vehicle not found</Text>
          </View>
        )}

        {/* Menu Grid */}
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { borderTopColor: item.color }]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* OBD Connection Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>🔌 OBD-II Connection</Text>
          <Text style={styles.statusText}>Not Connected</Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => navigation.navigate('OBDConnection')}
          >
            <Text style={styles.connectButtonText}>Connect to Vehicle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  welcomeCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  emailText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  vehicleCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: '#007AFF',
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vehicleIcon: {
    fontSize: 50,
    marginRight: 15,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 2,
  },
  vehicleModel: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  vehicleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  statusActive: {
    color: '#34C759',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  menuCard: {
    backgroundColor: '#fff',
    width: '48%',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 3,
    borderTopWidth: 4,
  },
  menuIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 3,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    color: '#FF3B30',
    marginBottom: 15,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
