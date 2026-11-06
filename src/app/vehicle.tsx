import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const vehicleId = id as string;

  const [vehicle, setVehicle] = useState<any>(null);
  const [rentals, setRentals] = useState<any[]>([]);

  useEffect(() => {
    if (!vehicleId) return;

    const unsubVehicle = onSnapshot(doc(db, 'vehicles', vehicleId), (snap) => {
      if (snap.exists()) {
        setVehicle({ id: snap.id, ...snap.data() });
      }
    });

    const loadRentals = async () => {
      try {
        const q = query(
          collection(db, 'rentals'),
          where('vehicleId', '==', vehicleId),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setRentals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.log('Rental load error:', e);
      }
    };
    loadRentals();

    return () => unsubVehicle();
  }, [vehicleId]);

  if (!vehicle) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  const statusColor = vehicle.status === 'On Rent' ? '#ef4444' : vehicle.status === 'In Shop' ? '#f59e0b' : '#10b981';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{vehicle.nickname || `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`}</Text>
      <Text style={styles.sub}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
      <Text style={styles.vin}>VIN {vehicle.vin}</Text>

      <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
        <Text style={styles.statusText}>{vehicle.status || 'Available'}</Text>
      </View>

      <Text style={styles.section}>Actions</Text>

      {vehicle.status !== 'On Rent' && (
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push({ pathname: '/inspection', params: { id: vehicleId, nickname: vehicle.nickname, type: 'checkout' } })}
        >
          <Text style={styles.btnText}>Check Out</Text>
        </TouchableOpacity>
      )}

      {vehicle.status === 'On Rent' && (
        <TouchableOpacity
          style={styles.checkinBtn}
          onPress={() => router.push({ pathname: '/inspection', params: { id: vehicleId, nickname: vehicle.nickname, type: 'checkin' } })}
        >
          <Text style={styles.btnText}>Check In</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>Mark as In Shop</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>Mark as Unavailable</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Previous Rentals</Text>
      {rentals.length === 0 ? (
        <Text style={styles.empty}>No previous rentals yet.</Text>
      ) : (
        rentals.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.rentalCard}
            onPress={() => router.push({ pathname: '/rental-history', params: { id: r.id } })}
          >
            <Text style={styles.rentalDate}>{r.date}</Text>
            <Text style={styles.rentalName}>{r.renterName}</Text>
            <Text style={styles.rentalType}>{r.type === 'checkout' ? 'Checked Out' : 'Checked In'}</Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 20 },
  loading: { color: '#fff', textAlign: 'center', marginTop: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  sub: { color: '#9ca3af', fontSize: 16, marginTop: 4 },
  vin: { color: '#6b7280', fontSize: 14, marginTop: 4, marginBottom: 16 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 24 },
  statusText: { color: '#fff', fontWeight: 'bold' },
  section: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 8, marginBottom: 12 },
  checkoutBtn: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  checkinBtn: { backgroundColor: '#10b981', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
  secondaryBtn: { backgroundColor: '#374151', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  secondaryText: { color: '#fff', fontSize: 16 },
  empty: { color: '#6b7280', fontStyle: 'italic' },
  rentalCard: { backgroundColor: '#1f2937', padding: 16, borderRadius: 12, marginBottom: 10 },
  rentalDate: { color: '#f59e0b', fontWeight: 'bold' },
  rentalName: { color: '#fff', fontSize: 16, marginTop: 4 },
  rentalType: { color: '#9ca3af', marginTop: 4 },
});