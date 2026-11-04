import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

// Simple shared list so status can update
let sharedVehicles = [
  {
    id: '1',
    nickname: "DAD'S 2004 DODGE 3500",
    yearMakeModel: '2004 Dodge Ram',
    specs: '5.9L · 6-cyl',
    vin: '3D7LU38C74G147814',
    status: 'Available',
  },
  {
    id: '2',
    nickname: '2026 HIGHLAND U10',
    yearMakeModel: '2026 Cfmoto UFORCE',
    specs: '1.0L · 88 hp',
    vin: 'LCELE1ZJ9TM007395',
    status: 'Available',
  },
];

export default function RentalLogScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState(sharedVehicles);

  const refresh = () => setVehicles([...sharedVehicles]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>My Rental Fleet</Text>
        <Text style={styles.subheader}>Vehicles</Text>

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
  scroll: { padding: 20, paddingBottom: 100 },
  header: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  subheader: { fontSize: 18, color: '#9ca3af', marginTop: 4, marginBottom: 20 },
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