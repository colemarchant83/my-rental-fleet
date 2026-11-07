import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function VehicleDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<any>(null);
  const [rentals, setRentals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Real-time listener for the vehicle document
    const vehicleRef = doc(db, 'vehicles', id as string);
    const unsubVehicle = onSnapshot(vehicleRef, (snap) => {
      if (snap.exists()) {
        setVehicle({ id: snap.id, ...snap.data() });
      }
    });

    // Real-time listener for rentals of this vehicle
    const rentalsQuery = query(
      collection(db, 'rentals'),
      where('vehicleId', '==', id),
      orderBy('createdAt', 'desc')
    );

    const unsubRentals = onSnapshot(rentalsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRentals(list);
      setLoading(false);
    }, (error) => {
      console.log('Rentals listener error:', error);
      setLoading(false);
    });

    return () => {
      unsubVehicle();
      unsubRentals();
    };
  }, [id]);

  const changeStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'vehicles', id as string), { status: newStatus });
    } catch (e) {
      Alert.alert('Error', 'Could not update status');
    }
  };

  const openInspection = (type: 'checkout' | 'checkin') => {
    router.push({
      pathname: '/inspection',
      params: { vehicleId: id, type }
    });
  };

  const openRental = (rentalId: string) => {
    router.push({
      pathname: '/rental-history',
      params: { id: rentalId }
    });
  };

  if (loading || !vehicle) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const isOnRent = vehicle.status === 'On Rent';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{vehicle.nickname || vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model}</Text>
      <Text style={styles.vin}>VIN {vehicle.vin}</Text>

      <View style={[styles.statusBadge, isOnRent ? styles.onRent : styles.available]}>
        <Text style={styles.statusText}>{vehicle.status || 'Available'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Actions</Text>

      {isOnRent ? (
        <TouchableOpacity style={styles.checkInBtn} onPress={() => openInspection('checkin')}>
          <Text style={styles.btnText}>Check In</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.checkOutBtn} onPress={() => openInspection('checkout')}>
          <Text style={styles.btnText}>Check Out</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => changeStatus('In Shop')}>
        <Text style={styles.secondaryText}>Mark as In Shop</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryBtn} onPress={() => changeStatus('Unavailable')}>
        <Text style={styles.secondaryText}>Mark as Unavailable</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Previous Rentals</Text>

      {rentals.length === 0 ? (
        <Text style={styles.empty}>No previous rentals yet.</Text>
      ) : (
        <FlatList
          data={rentals}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.rentalCard} onPress={() => openRental(item.id)}>
              <Text style={styles.rentalDate}>
                {item.checkoutDate || item.createdAt?.toDate?.().toLocaleDateString() || '—'}
              </Text>
              <Text style={styles.renterName}>{item.renterName || 'Unknown'}</Text>
              <Text style={styles.rentalStatus}>
                {item.checkinDate ? 'Checked In' : 'Checked Out'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  vin: { color: '#94a3b8', marginBottom: 12 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 20 },
  onRent: { backgroundColor: '#dc2626' },
  available: { backgroundColor: '#16a34a' },
  statusText: { color: 'white', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginTop: 16, marginBottom: 10 },
  checkOutBtn: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  checkInBtn: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  btnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  secondaryBtn: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  secondaryText: { color: '#cbd5e1', fontWeight: '600' },
  rentalCard: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12, marginBottom: 8 },
  rentalDate: { color: '#f59e0b', fontWeight: '600' },
  renterName: { color: '#f8fafc', fontSize: 16, marginTop: 2 },
  rentalStatus: { color: '#94a3b8', marginTop: 2 },
  empty: { color: '#64748b', fontStyle: 'italic' },
  loading: { color: '#f8fafc', textAlign: 'center', marginTop: 40 },
});