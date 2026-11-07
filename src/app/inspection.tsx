import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

const PHOTO_AREAS = ['Front', 'Driver Side', 'Rear', 'Passenger Side', 'Windshield', 'Interior', 'Tires & Wheels'];

export default function Inspection() {
  const params = useLocalSearchParams();
  const vehicleId = params.vehicleId as string | undefined;
  const type = params.type as string | undefined;
  const router = useRouter();
  const isCheckout = type === 'checkout';

  const [renterName, setRenterName] = useState('');
  const [miles, setMiles] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<Record<string, string[]>>({});

  const takePhoto = async (area: string) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => ({
        ...prev,
        [area]: [...(prev[area] || []), result.assets[0].uri],
      }));
    }
  };

  const uploadPhotos = async () => {
    const uploaded: Record<string, string[]> = {};
    for (const [area, uris] of Object.entries(photos)) {
      uploaded[area] = [];
      for (const uri of uris) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const storageRef = ref(storage, `rentals/${vehicleId}/${filename}`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        uploaded[area].push(url);
      }
    }
    return uploaded;
  };

  const complete = async () => {
    if (!vehicleId) {
      Alert.alert('Error', 'Missing vehicle ID');
      return;
    }
    if (!renterName.trim()) {
      Alert.alert('Required', 'Please enter the renter name');
      return;
    }

    try {
      const uploadedPhotos = Object.keys(photos).length > 0 ? await uploadPhotos() : {};

      if (isCheckout) {
        await addDoc(collection(db, 'rentals'), {
          vehicleId,
          renterName: renterName.trim(),
          checkoutMiles: miles,
          checkoutHours: hours,
          checkoutDate: new Date().toLocaleDateString(),
          checkoutTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          checkoutNotes: notes,
          photos: uploadedPhotos,
          notes: { general: notes },
          createdAt: serverTimestamp(),
          status: 'Checked Out',
        });

        await updateDoc(doc(db, 'vehicles', vehicleId), { status: 'On Rent' });
      } else {
        const q = query(
          collection(db, 'rentals'),
          where('vehicleId', '==', vehicleId),
          where('status', '==', 'Checked Out')
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          Alert.alert('Error', 'No open rental found');
          return;
        }
        const openRental = snap.docs[0];

        await updateDoc(openRental.ref, {
          checkinMiles: miles,
          checkinHours: hours,
          checkinDate: new Date().toLocaleDateString(),
          checkinTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          checkinNotes: notes,
          photos: { ...(openRental.data().photos || {}), ...uploadedPhotos },
          status: 'Checked In',
        });

        await updateDoc(doc(db, 'vehicles', vehicleId), { status: 'Available' });
      }

      Alert.alert('Success', isCheckout ? 'Checked out' : 'Checked in');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{isCheckout ? 'Check Out' : 'Check In'}</Text>

      <Text style={styles.label}>Renter Name</Text>
      <TextInput style={styles.input} value={renterName} onChangeText={setRenterName} placeholder="Enter renter name" placeholderTextColor="#64748b" />

      <Text style={styles.label}>Miles</Text>
      <TextInput style={styles.input} value={miles} onChangeText={setMiles} keyboardType="numeric" placeholder="Enter miles" placeholderTextColor="#64748b" />

      <Text style={styles.label}>Hours</Text>
      <TextInput style={styles.input} value={hours} onChangeText={setHours} keyboardType="numeric" placeholder="Enter hours" placeholderTextColor="#64748b" />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, { height: 80 }]} value={notes} onChangeText={setNotes} multiline placeholder="Notes..." placeholderTextColor="#64748b" />

      <Text style={styles.sectionTitle}>Photos</Text>
      {PHOTO_AREAS.map(area => (
        <View key={area} style={styles.areaContainer}>
          <Text style={styles.areaTitle}>{area}</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto(area)}>
            <Text style={styles.photoBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <View style={styles.thumbRow}>
            {(photos[area] || []).map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.thumb} />
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.completeBtn} onPress={complete}>
        <Text style={styles.completeText}>Complete {isCheckout ? 'Check Out' : 'Check In'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 20 },
  label: { color: '#cbd5e1', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', padding: 14, borderRadius: 10, fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginTop: 24, marginBottom: 12 },
  areaContainer: { marginBottom: 16 },
  areaTitle: { color: '#cbd5e1', marginBottom: 8 },
  photoBtn: { backgroundColor: '#334155', padding: 12, borderRadius: 8, alignItems: 'center' },
  photoBtnText: { color: '#f8fafc' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  thumb: { width: 70, height: 70, borderRadius: 6, marginRight: 6, marginBottom: 6 },
  completeBtn: { backgroundColor: '#16a34a', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 40 },
  completeText: { color: 'white', fontWeight: '700', fontSize: 16 },
});