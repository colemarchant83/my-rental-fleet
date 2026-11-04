import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const sampleRentals = [
  { id: 'r1', date: 'Nov 3, 2026', renter: 'John Smith', status: 'Completed' },
  { id: 'r2', date: 'Oct 28, 2026', renter: 'Sarah Lee', status: 'Completed' },
  { id: 'r3', date: 'Oct 15, 2026', renter: 'Mike Johnson', status: 'Completed' },
];

export default function VehicleDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const nickname = params.nickname as string;
  const yearMakeModel = params.yearMakeModel as string;
  const specs = params.specs as string;
  const vin = params.vin as string;
  const status = params.status as string;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.nickname}>{nickname}</Text>
      <Text style={styles.yearMakeModel}>{yearMakeModel}</Text>
      <Text style={styles.specs}>{specs}</Text>
      <Text style={styles.vin}>VIN {vin}</Text>

      <View style={[styles.statusBadge, status === 'On Rent' && styles.onRentBadge]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <Text style={styles.sectionTitle}>Actions</Text>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() =>
          router.push({
            pathname: '/inspection',
            params: { nickname, id: params.id, type: 'checkout' },
          })
        }
      >
        <Text style={styles.actionButtonText}>Check Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
        <Text style={styles.secondaryButtonText}>Mark as In Shop</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
        <Text style={styles.secondaryButtonText}>Mark as Unavailable</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Previous Rentals</Text>

      {sampleRentals.map((rental) => (
        <TouchableOpacity
          key={rental.id}
          style={styles.rentalCard}
          onPress={() =>
            router.push({
              pathname: '/rental-history',
              params: { nickname, rentalId: rental.id, date: rental.date, renter: rental.renter },
            })
          }
        >
          <Text style={styles.rentalDate}>{rental.date}</Text>
          <Text style={styles.rentalRenter}>{rental.renter}</Text>
          <Text style={styles.rentalStatus}>{rental.status}</Text>
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
  rentalCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  rentalDate: { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  rentalRenter: { color: '#fff', fontSize: 15, marginTop: 2 },
  rentalStatus: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
});