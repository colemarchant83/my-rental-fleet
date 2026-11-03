import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

export default function InspectionScreen() {
  const params = useLocalSearchParams();
  const nickname = params.nickname as string;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pre-Rental Inspection</Text>
      <Text style={styles.subtitle}>{nickname}</Text>

      <Text style={styles.section}>Photo Areas</Text>
      {photoAreas.map((area) => (
        <TouchableOpacity key={area} style={styles.areaButton}>
          <Text style={styles.areaText}>{area}</Text>
          <Text style={styles.areaHint}>Tap to add photos</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.videoButton}>
        <Text style={styles.videoButtonText}>Record Before Video</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#f59e0b',
    marginTop: 4,
    marginBottom: 20,
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  areaButton: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
  },
  areaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  areaHint: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  videoButton: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  videoButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: 'bold',
  },
});