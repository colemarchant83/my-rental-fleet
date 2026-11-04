import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

const photoAreas = [
  'Front',
  'Driver’s Side',
  'Rear',
  'Passenger Side',
  'Windshield',
  'Interior',
  'Tires & Wheels',
];

const sampleBefore = 'https://via.placeholder.com/150/374151/ffffff?text=Out';
const sampleAfter = 'https://via.placeholder.com/150/1f2937/ffffff?text=In';

export default function RentalHistoryScreen() {
  const params = useLocalSearchParams();
  const nickname = params.nickname as string;
  const date = params.date as string;
  const renter = params.renter as string;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Rental History</Text>
      <Text style={styles.subtitle}>{nickname}</Text>
      <Text style={styles.renter}>{renter}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Check Out</Text>
          <Text style={styles.infoValue}>{date}</Text>
          <Text style={styles.infoValue}>10:30 AM</Text>
          <Text style={styles.infoValue}>Miles: 45,230</Text>
          <Text style={styles.infoValue}>Hours: 1,240</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Check In</Text>
          <Text style={styles.infoValue}>{date}</Text>
          <Text style={styles.infoValue}>4:15 PM</Text>
          <Text style={styles.infoValue}>Miles: 45,385</Text>
          <Text style={styles.infoValue}>Hours: 1,248</Text>
        </View>
      </View>

      <Text style={styles.section}>Videos</Text>
      <View style={styles.videoRow}>
        <TouchableOpacity style={styles.videoBox}>
          <Text style={styles.videoLabel}>Check Out Video</Text>
          <Text style={styles.videoPlaceholder}>▶ Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.videoBox}>
          <Text style={styles.videoLabel}>Check In Video</Text>
          <Text style={styles.videoPlaceholder}>▶ Play</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>Photo Areas</Text>

      {photoAreas.map((area) => (
        <View key={area} style={styles.areaContainer}>
          <Text style={styles.areaTitle}>{area}</Text>

          <View style={styles.photoRow}>
            <View style={styles.photoColumn}>
              <Text style={styles.photoLabel}>Check Out</Text>
              <Image source={{ uri: sampleBefore }} style={styles.thumbnail} />
            </View>
            <View style={styles.photoColumn}>
              <Text style={styles.photoLabel}>Check In</Text>
              <Image source={{ uri: sampleAfter }} style={styles.thumbnail} />
            </View>
          </View>

          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>No issues noted.</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#f59e0b', marginTop: 4 },
  renter: { fontSize: 15, color: '#9ca3af', marginTop: 2, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  infoBox: {
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 10,
    width: '48%',
  },
  infoLabel: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
  infoValue: { color: '#fff', fontSize: 14, marginTop: 2 },
  section: { fontSize: 18, fontWeight: '600', color: '#e5e7eb', marginBottom: 12, marginTop: 8 },
  videoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  videoBox: {
    backgroundColor: '#1f2937',
    width: '48%',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  videoLabel: { color: '#9ca3af', fontSize: 13, marginBottom: 8 },
  videoPlaceholder: { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  areaContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  areaTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  photoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  photoColumn: { width: '48%', alignItems: 'center' },
  photoLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  thumbnail: { width: '100%', height: 100, borderRadius: 8, backgroundColor: '#374151' },
  notesLabel: { color: '#9ca3af', fontSize: 13, marginTop: 10 },
  notesText: { color: '#e5e7eb', fontSize: 14, marginTop: 2 },
});