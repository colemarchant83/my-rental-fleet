import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const photoAreas = [
  'Front',
  'Driver\'s Side',
  'Rear',
  'Passenger Side',
  'Windshield',
  'Interior',
  'Tires & Wheels',
];

export default function InspectionScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const nickname = params.nickname as string;
  const vehicleId = params.id as string;
  const type = (params.type as string) || 'checkout';

  const now = new Date();
  const [renterName, setRenterName] = useState('');
  const [miles, setMiles] = useState('');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(now.toLocaleDateString());
  const [time, setTime] = useState(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [videos, setVideos] = useState<string[]>([]);

  const pickPhotos = async (area: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setPhotos((prev) => ({ ...prev, [area]: [...(prev[area] || []), ...newUris] }));
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow media access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setVideos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const completeInspection = async () => {
    if (!vehicleId) {
      Alert.alert('Error', 'No vehicle ID. Go back and try again.');
      return;
    }

    const rentalData: any = {
      vehicleId,
      type,
      renterName: renterName || 'Unknown',
      miles: miles || '',
      hours: hours || '',
      date,
      time,
      photos,
      notes,
      videos,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'rentals'), rentalData);

      const newStatus = type === 'checkout' ? 'On Rent' : 'Available';
      await updateDoc(doc(db, 'vehicles', vehicleId), { status: newStatus });

      Alert.alert('Success', `${type === 'checkout' ? 'Check Out' : 'Check In'} complete.\nStatus set to ${newStatus}.`);
      
      router.replace('/(tabs)');
    } catch (error: any) {
      console.log('FULL ERROR:', error);
      Alert.alert(
        'Save Failed',
        `Could not save.\n\n${error.message || error}\n\nCheck your internet and Firebase rules.`
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{type === 'checkout' ? 'Check Out' : 'Check In'} – {nickname || 'Vehicle'}</Text>

      <Text style={styles.label}>Renter Name</Text>
      <TextInput style={styles.input} placeholder="Enter renter name" placeholderTextColor="#6b7280" value={renterName} onChangeText={setRenterName} />

      <Text style={styles.label}>Miles</Text>
      <TextInput style={styles.input} placeholder="Enter miles" placeholderTextColor="#6b7280" keyboardType="numeric" value={miles} onChangeText={setMiles} />

      <Text style={styles.label}>Hours</Text>
      <TextInput style={styles.input} placeholder="Enter hours" placeholderTextColor="#6b7280" keyboardType="numeric" value={hours} onChangeText={setHours} />

      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} />

      <Text style={styles.label}>Time</Text>
      <TextInput style={styles.input} value={time} onChangeText={setTime} />

      <Text style={styles.sectionTitle}>Photo Areas</Text>

      {photoAreas.map((area) => (
        <View key={area} style={styles.areaBlock}>
          <TouchableOpacity style={styles.areaCard} onPress={() => pickPhotos(area)}>
            <Text style={styles.areaName}>{area}</Text>
            <Text style={styles.areaHint}>
              {photos[area]?.length ? `${photos[area].length} photo(s)` : 'Tap to add photos'}
            </Text>
            {photos[area]?.length > 0 && (
              <View style={styles.thumbRow}>
                {photos[area].map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.thumb} />
                ))}
              </View>
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.notesInput}
            placeholder={`Notes for ${area}...`}
            placeholderTextColor="#6b7280"
            value={notes[area] || ''}
            onChangeText={(text) => setNotes((prev) => ({ ...prev, [area]: text }))}
            multiline
          />
        </View>
      ))}

      <TouchableOpacity style={styles.videoButton} onPress={pickVideo}>
        <Text style={styles.videoButtonText}>Add Video (Record or Upload)</Text>
      </TouchableOpacity>
      {videos.length > 0 && <Text style={styles.videoCount}>{videos.length} video(s) added</Text>}

      <TouchableOpacity style={styles.completeButton} onPress={completeInspection}>
        <Text style={styles.completeButtonText}>Complete {type === 'checkout' ? 'Check Out' : 'Check In'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  label: { color: '#9ca3af', fontSize: 15, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1f2937', color: '#fff', padding: 14, borderRadius: 10, fontSize: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 24, marginBottom: 12 },
  areaBlock: { marginBottom: 16 },
  areaCard: { backgroundColor: '#1f2937', padding: 16, borderRadius: 12 },
  areaName: { color: '#fff', fontSize: 17, fontWeight: '600' },
  areaHint: { color: '#9ca3af', fontSize: 14, marginTop: 4 },
  thumbRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  thumb: { width: 60, height: 60, borderRadius: 8 },
  notesInput: {
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  videoButton: { backgroundColor: '#f59e0b', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  videoButtonText: { color: '#111827', fontSize: 16, fontWeight: 'bold' },
  videoCount: { color: '#9ca3af', marginTop: 8, textAlign: 'center' },
  completeButton: {
    backgroundColor: '#10b981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  completeButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});