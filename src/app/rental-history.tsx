import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

export default function RentalHistory() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [rental, setRental] = useState<any>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'rentals', id as string)).then(snap => {
      if (snap.exists()) setRental({ id: snap.id, ...snap.data() });
    });
  }, [id]);

  const deleteRental = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      if (rental?.photos) {
        for (const urls of Object.values(rental.photos)) {
          for (const url of urls as string[]) {
            try {
              const path = decodeURIComponent(url.split('/o/')[1]?.split('?')[0] || '');
              if (path) await deleteObject(ref(storage, path));
            } catch {}
          }
        }
      }
      await deleteDoc(doc(db, 'rentals', id as string));
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Could not delete');
    }
  };

  if (!rental) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  const isCheckedIn = !!rental.checkinDate;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.renter}>{rental.renterName || 'Unknown'}</Text>
      <Text style={styles.date}>{rental.checkoutDate} {rental.checkoutTime}</Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Checkout Miles</Text>
          <Text style={styles.value}>{rental.checkoutMiles || '—'}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Checkout Hours</Text>
          <Text style={styles.value}>{rental.checkoutHours || '—'}</Text>
        </View>
      </View>

      {isCheckedIn && (
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Check-in Miles</Text>
            <Text style={styles.value}>{rental.checkinMiles || '—'}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Check-in Hours</Text>
            <Text style={styles.value}>{rental.checkinHours || '—'}</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Photos</Text>
      {rental.photos && Object.keys(rental.photos).length > 0 ? (
        Object.entries(rental.photos).map(([area, urls]: any) => (
          <View key={area} style={styles.areaContainer}>
            <Text style={styles.areaTitle}>{area}</Text>
            <View style={styles.thumbRow}>
              {urls.map((url: string, i: number) => (
                <TouchableOpacity key={i} onPress={() => setZoomedPhoto(url)}>
                  <Image source={{ uri: url }} style={styles.thumb} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.placeholder}>No photos saved</Text>
      )}

      <Text style={styles.sectionTitle}>Notes</Text>
      <Text style={styles.notes}>{rental.checkoutNotes || rental.notes?.general || 'No notes'}</Text>
      {rental.checkinNotes && <Text style={styles.notes}>{rental.checkinNotes}</Text>}

      <TouchableOpacity style={styles.deleteBtn} onPress={deleteRental}>
        <Text style={styles.deleteText}>{confirmDelete ? 'Tap Again to Confirm Delete' : 'Delete This Rental'}</Text>
      </TouchableOpacity>

      <Modal visible={!!zoomedPhoto} transparent animationType="fade">
        <View style={styles.modal}>
          {zoomedPhoto && <Image source={{ uri: zoomedPhoto }} style={styles.zoomed} resizeMode="contain" />}
          <TouchableOpacity style={styles.closeBtn} onPress={() => setZoomedPhoto(null)}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  renter: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  date: { color: '#94a3b8', marginBottom: 16 },
  row: { flexDirection: 'row', marginBottom: 12 },
  col: { flex: 1 },
  label: { color: '#94a3b8', fontSize: 12 },
  value: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginTop: 20, marginBottom: 10 },
  areaContainer: { marginBottom: 16 },
  areaTitle: { color: '#cbd5e1', marginBottom: 8 },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: 80, height: 80, borderRadius: 6, marginRight: 8, marginBottom: 8 },
  placeholder: { color: '#64748b', fontStyle: 'italic' },
  notes: { color: '#e2e8f0', marginBottom: 8 },
  deleteBtn: { backgroundColor: '#dc2626', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 40 },
  deleteText: { color: 'white', fontWeight: '700' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomed: { width: '95%', height: '80%' },
  closeBtn: { position: 'absolute', bottom: 40, backgroundColor: '#334155', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  closeText: { color: 'white', fontWeight: '600' },
  loading: { color: '#f8fafc', textAlign: 'center', marginTop: 40 },
});