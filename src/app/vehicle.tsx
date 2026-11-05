import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export default function VehicleDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const vehicleId = params.id as string;
  const [vehicle, setVehicle] = useState<any>(params);
  const [currentRental, setCurrentRental] = useState<any>(null);
  const [pastRentals, setPastRentals] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!vehicleId) return;

      const unsubVehicle = onSnapshot(doc(db, 'vehicles', vehicleId), (snap) => {
        if (snap.exists()) {
          setVehicle({ id: snap.id, ...snap.data() });
        }
      });

      const unsubRentals = onSnapshot(
        query(collection(db, 'rentals'), where('vehicleId', '==', vehicleId)),
        (snapshot) => {
          const all = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));

          const current = all.find((r: any) => r.type === 'checkout');
          setCurrentRental(current || null);
          setPastRentals(all.filter((r: any) => r.id !== current?.id));
        }
      );

      return () => {
        unsubVehicle();
        unsubRentals();
      };
    }, [vehicleId])
  );

  const status = vehicle.status || 'Available';
  const isOnRent = status === 'On Rent';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.nickname}>{vehicle.nickname}</Text>
      <Text style={styles.yearMakeModel}>{vehicle.yearMakeModel}</Text>
      <Text style={styles.specs}>{vehicle.specs}</Text>
      <Text style={styles.vin}>VIN {vehicle.vin}</Text>

      <View style={[styles.statusBadge, isOnRent && styles.onRentBadge]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <Text style={styles.sectionTitle}>Actions</Text>

      {!isOnRent && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            router.push({
              pathname: '/inspection',
              params: { nickname: vehicle.nickname, id: vehicleId, type: 'checkout' },
            })
          }
        >
          <Text style={styles.actionButtonText}>Check Out</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
        <Text style={styles.secondaryButtonText}>Mark as In Shop</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
        <Text style={styles.secondaryButtonText}>Mark as Unavailable</Text>
      </TouchableOpacity>

      {isOnRent && currentRental && (
        <>
          <Text style={styles.sectionTitle}>Current Rental</Text>
          <TouchableOpacity
            style={styles.currentRentalCard}
            onPress={() =>
              router.push({
                pathname: '/rental-history',
                params: {
                  nickname: vehicle.nickname,
                  rentalId: currentRental.id,
                  date: currentRental.date,
                  renter: currentRental.renterName,
                  current: 'true',
                },
              })
            }
          >
            <Text style={styles.currentLabel}>On Rent Now</Text>
            <Text style={styles.currentRenter}>{currentRental.renterName}</Text>
            <Text style={styles.currentDate}>{currentRental.date} · {currentRental.time}</Text>
            <Text style={styles.currentDate}>Miles: {currentRental.miles || '—'} · Hours: {currentRental.hours || '—'}</Text>

            <TouchableOpacity
              style={styles.checkInButton}
              onPress={() =>
                router.push({
                  pathname: '/inspection',
                  params: { nickname: vehicle.nickname, id: vehicleId, type: 'checkin' },
                })
              }
            >
              <Text style={styles.checkInButtonText}>Check In</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.sectionTitle}>Previous Rentals</Text>

      {pastRentals.length === 0 && <Text style={styles.empty}>No previous rentals yet.</Text>}

      {pastRentals.map((rental) => (
        <TouchableOpacity
          key={rental.id}
          style={styles.rentalCard}
          onPress={() =>
            router.push({
              pathname: '/rental-history',
              params: { nickname: vehicle.nickname, rentalId: rental.id, date: rental.date, renter: rental.renterName },
            })
          }
        >
          <Text style={styles.rentalDate}>{rental.date}</Text>
          <Text style={styles.rentalRenter}>{rental.renterName}</Text>
          <Text style={styles.rentalStatus}>{rental.type === 'checkin' ? 'Checked In' : 'Checked Out'}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 20 },
  nickname: { fontSize: 18, fontWeight: 'bold', color: '#f59e0b' },
  yearMakeModel: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  specs: { fontSize: 16, color: '#9ca3af', marginTop: 4 },
  vin: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  statusBadge: {
    backgroundColor: '#10b981',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 16,
  },
  onRentBadge: { backgroundColor: '#f59e0b' },
  statusText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 28, marginBottom: 12 },
  actionButton: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: '#374151' },
  secondaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  currentRentalCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  currentLabel: { color: '#f59e0b', fontSize: 14, fontWeight: '600' },
  currentRenter: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  currentDate: { color: '#9ca3af', fontSize: 14, marginTop: 2 },
  checkInButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  checkInButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  rentalCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  rentalDate: { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  rentalRenter: { color: '#fff', fontSize: 15, marginTop: 2 },
  rentalStatus: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  empty: { color: '#6b7280', fontStyle: 'italic' },
});