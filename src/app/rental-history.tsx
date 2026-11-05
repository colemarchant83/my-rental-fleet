import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Linking, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

const { width, height } = Dimensions.get('window');

export default function RentalHistoryScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rentalId = params.rentalId as string;
  const nickname = params.nickname as string;
  const [rental, setRental] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!rentalId) {
      setLoading(false);
      return;
    }

    getDoc(doc(db, 'rentals', rentalId)).then((snap) => {
      if (snap.exists()) {
        setRental({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
  }, [rentalId]);

  const deleteRental = () => {
    Alert.alert(
      'Delete Rental',
      'This will permanently delete this rental and all its photos and videos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (rental?.photos) {
                for (const area of Object.keys(rental.photos)) {
                  for (const url of rental.photos[area] || []) {
                    try {
                      const path = decodeURIComponent(url.split('/o/')[1]?.split('?')[0] || '');
                      if (path) await deleteObject(ref(storage, path));
                    } catch (e) {}
                  }
                }
              }
              if (rental?.videoUri) {
                try {
                  const path = decodeURIComponent(rental.videoUri.split('/o/')[1]?.split('?')[0] || '');
                  if (path) await deleteObject(ref(storage, path));
                } catch (e) {}
              }

              // If this was an open check-out, set vehicle back to Available
              if (rental?.type === 'checkout' && rental?.vehicleId) {
                await updateDoc(doc(db, 'vehicles', rental.vehicleId), {
                  status: 'Available',
                });
              }

              await deleteDoc(doc(db, 'rentals', rentalId));
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Could not delete rental.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!rental) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Rental not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Rental History</Text>
        <Text style={styles.subtitle}>{nickname}</Text>
        <Text style={styles.renter}>{rental.renterName}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Check Out</Text>
            <Text style={styles.infoValue}>{rental.date}</Text>
            <Text style={styles.infoValue}>{rental.time}</Text>
            <Text style={styles.infoValue}>Miles: {rental.miles || '—'}</Text>
            <Text style={styles.infoValue}>Hours: {rental.hours || '—'}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Check In</Text>
            <Text style={styles.infoValue}>—</Text>
            <Text style={styles.infoValue}>—</Text>
            <Text style={styles.infoValue}>Miles: —</Text>
            <Text style={styles.infoValue}>Hours: —</Text>
          </View>
        </View>

        <Text style={styles.section}>Videos</Text>
        <View style={styles.videoRow}>
          <TouchableOpacity
            style={styles.videoBox}
            onPress={() => rental.videoUri && Linking.openURL(rental.videoUri)}
          >
            <Text style={styles.videoLabel}>Check Out Video</Text>
            <Text style={styles.videoPlaceholder}>{rental.videoUri ? '▶ Open' : 'No video'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoBox}>
            <Text style={styles.videoLabel}>Check In Video</Text>
            <Text style={styles.videoPlaceholder}>No video</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Photo Areas</Text>

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
          <Text style={styles.placeholderText}>No photos saved</Text>
        )}

        <TouchableOpacity style={styles.deleteButton} onPress={deleteRental}>
          <Text style={styles.deleteButtonText}>Delete This Rental</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!zoomedPhoto} transparent animationType="fade">
        <View style={styles.modal}>
          {zoomedPhoto && (
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              contentContainerStyle={styles.zoomContainer}
              centerContent
            >
              <Image
                source={{ uri: zoomedPhoto }}
                style={styles.zoomedImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={() => setZoomedPhoto(null)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  center: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#f59e0b', marginTop: 4 },
  renter: { fontSize: 15, color: '#9ca3af', marginTop: 2, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  infoBox: { backgroundColor: '#1f2937', padding: 12, borderRadius: 10, width: '48%' },
  infoLabel: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
  infoValue: { color: '#fff', fontSize: 14, marginTop: 2 },
  section: { fontSize: 18, fontWeight: '600', color: '#e5e7eb', marginBottom: 12, marginTop: 8 },
  videoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  videoBox: { backgroundColor: '#1f2937', width: '48%', padding: 16, borderRadius: 10, alignItems: 'center' },
  videoLabel: { color: '#9ca3af', fontSize: 13, marginBottom: 8 },
  videoPlaceholder: { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  areaContainer: { backgroundColor: '#1f2937', borderRadius: 12, padding: 14, marginBottom: 16 },
  areaTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 10 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap' },
  thumbnail: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#374151', marginRight: 8, marginBottom: 8 },
  placeholderText: { color: '#6b7280', fontSize: 12 },
  notesLabel: { color: '#9ca3af', fontSize: 13, marginTop: 10 },
  notesText: { color: '#e5e7eb', fontSize: 14, marginTop: 2 },
  deleteButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  error: { color: '#fff', fontSize: 16 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomedImage: { width: width, height: height * 0.8 },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});