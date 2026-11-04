import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

const sampleBefore = 'https://via.placeholder.com/300x200/374151/ffffff?text=Before';
const sampleAfter = 'https://via.placeholder.com/300x200/1f2937/ffffff?text=After';

export default function CompareScreen() {
  const params = useLocalSearchParams();
  const nickname = params.nickname as string;
  const area = (params.area as string) || 'Front';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Side-by-Side Comparison</Text>
      <Text style={styles.subtitle}>{nickname} — {area}</Text>

      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Check Out</Text>
          <Image source={{ uri: sampleBefore }} style={styles.image} />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Check In</Text>
          <Image source={{ uri: sampleAfter }} style={styles.image} />
        </View>
      </View>

      <Text style={styles.note}>
        Tap a photo later to zoom. Real before/after photos will appear here once saving is connected.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#f59e0b', marginTop: 4, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  column: { width: '48%' },
  label: { color: '#e5e7eb', fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  image: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#374151' },
  note: { color: '#9ca3af', marginTop: 20, textAlign: 'center', fontSize: 14 },
});