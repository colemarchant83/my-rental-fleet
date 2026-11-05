import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function RentalLogScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVehicles(list);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const addSampleVehicles = async () => {
    const samples = [
      {
        nickname: "DAD'S 2004 DODGE 3500",
        yearMakeModel: '2004 Dodge Ram',
        specs: '5.9L · 6-cyl',
        vin: '3D7LU38C74G147814',
        status: 'Available',
      },
      {
        nickname: '2026 HIGHLAND U10',
        yearMakeModel: '2026 Cfmoto UFORCE',
        specs: '1.0L · 88 hp',
        vin: 'LCELE1ZJ9TM007395',
        status: 'Available',
      },
    ];

    for (const vehicle of samples) {
      await addDoc(collection(db, 'vehicles'), vehicle);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>My Rental Fleet</Text>
        <Text style={styles.subheader}>Vehicles</Text>

        {vehicles.length === 0 && (
          <TouchableOpacity style={styles.sampleButton} onPress={addSampleVehicles}>
            <Text style={styles.sampleButtonText}>Add Sample Vehicles</Text>
          </TouchableOpacity>
        )}

        {vehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/vehicle',
                params: vehicle,
              })
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.nickname}>{vehicle.nickname}</Text>
              <View
                style={[
                  styles.statusBadge,
                  vehicle.status === 'On Rent' && { backgroundColor: '#f59e0b' },
                ]}
              >
                <Text style={styles.statusText}>{vehicle.status}</Text>
              </View>
            </View>
            <Text style={styles.yearMakeModel}>{vehicle.yearMakeModel}</Text>
            <Text style={styles.specs}>{vehicle.specs}</Text>
            <Text style={styles.vin}>VIN {vehicle.vin}</Text>
            <Text style={styles.checkoutLink}>Check out — pre-rental inspection →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add')}>
        <Text style={styles.addButtonText}>+ Add Vehicle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  subheader: { fontSize: 18, color: '#9ca3af', marginTop: 4, marginBottom: 20 },
  sampleButton: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  sampleButtonText: { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nickname: { fontSize: 16, fontWeight: 'bold', color: '#f59e0b', flex: 1 },
  statusBadge: { backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  yearMakeModel: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 6 },
  specs: { fontSize: 14, color: '#9ca3af', marginTop: 2 },
  vin: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  checkoutLink: { fontSize: 14, color: '#f59e0b', marginTop: 10, fontWeight: '600' },
  addButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: { color: '#111827', fontSize: 18, fontWeight: 'bold' },
});