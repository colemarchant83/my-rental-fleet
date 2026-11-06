import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function RentalHistoryScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const rentalId = id as string;

  const [rental, setRental] = useState<any>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rentalId) {
      setLoading(false);
      return;
    }

    const fetchRental = async () => {
      try {
        const snap = await getDoc(doc(db, 'rentals', rentalId));
        if (snap.exists()) {
          setRental({ id: snap.id, ...snap.data() });
        } else {
          console.log('Document does not exist for id:', rentalId);
        }
      } catch (e) {
        console.log('Fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchRental();
  }, [rentalId]);

  const deleteRental = () => {
    Alert.alert(
      'Delete Rental',
      'This will permanently delete this rental and all its photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'rentals', rentalId));
              Alert.alert('Deleted', 'Rental removed.');
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not delete');
            }
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;
  if (!rental) return <View style={styles.container}><Text style={styles.loading}>Rental not found</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{rental.renterName || 'Rental'}</Text>
      <Text style={styles.date}>{rental.date} at {rental.time}</Text>
      <Text style={styles.type}>{rental.type === 'checkout' ? 'Check Out' : 'Check In'}</Text>

      <Text style={styles.meta}>Miles: {rental.miles || '—'}   Hours: {rental.hours || '—'}</Text>

      {rental.photos && Object.keys(rental.photos).length > 0 ? (
        Object.entries(rental.photos).map(([area, urls]: any) => (
          <View key={area} style={styles.areaContainer}>
            <Text style={styles.areaTitle}>{area}</Text>
            <View style={styles.photoRow}>
              {urls.map((url: string, index: number) => (
                <TouchableOpacity key={index} onPress={() => setZoomedPhoto(url)}>
                  <Image source={{ uri: url }} style={styles.thumbnail} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{rental.notes?.[area] || 'No notes'}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.placeholder}>No photos saved</Text>
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={deleteRental}>
        <Text style={styles.deleteText}>Delete This Rental</Text>
      </TouchableOpacity>

      <Modal visible={!!zoomedPhoto} transparent animationType="fade">
        <View style={styles.modal}>
          {zoomedPhoto && (
            <Image source={{ uri: zoomedPhoto }} style={styles.zoomedImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.closeButton} onPress={() => setZoomedPhoto(null)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 20 },
  loading: { color: '#fff', textAlign: 'center', marginTop: 40, fontSize: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  date: { color: '#9ca3af', marginTop: 4 },
  type: { color: '#f59e0b', fontWeight: '600', marginTop: 4, marginBottom: 12 },
  meta: { color: '#d1d5db', marginBottom: 20 },
  areaContainer: { marginBottom: 24 },
  areaTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnail: { width: 80, height: 80, borderRadius: 8 },
  notesLabel: { color: '#9ca3af', marginTop: 8, fontSize: 14 },
  notesText: { color: '#fff', marginTop: 2 },
  placeholder: { color: '#6b7280', fontStyle: 'italic' },
  deleteButton: { backgroundColor: '#ef4444', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  deleteText: { color: '#fff', fontWeight: 'bold' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomedImage: { width: '95%', height: '80%' },
  closeButton: { position: 'absolute', bottom: 40, backgroundColor: '#374151', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  closeButtonText: { color: '#fff', fontWeight: 'bold' },
});