import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function VehicleListScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setVehicles(list);
    });
    return unsub;
  }, []);

  const addSample = async () => {
    await addDoc(collection(db, 'vehicles'), {
      nickname: 'Sample Vehicle',
      yearMakeModel: '2020 Example',
      specs: 'Test',
      vin: 'TEST123',
      status: 'Available',
    });
  };

  const openVehicle = (item: any) => {
    router.push(`/vehicle?id=${item.id}&nickname=${encodeURIComponent(item.nickname || '')}&yearMakeModel=${encodeURIComponent(item.yearMakeModel || '')}&specs=${encodeURIComponent(item.specs || '')}&vin=${encodeURIComponent(item.vin || '')}&status=${encodeURIComponent(item.status || 'Available')}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Rental Fleet</Text>

      <TouchableOpacity style={styles.addButton} onPress={addSample}>
        <Text style={styles.addButtonText}>+ Add Sample Vehicle</Text>
      </TouchableOpacity>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openVehicle(item)}>
            <Text style={styles.nickname}>{item.nickname}</Text>
            <Text style={styles.yearMakeModel}>{item.yearMakeModel}</Text>
            <Text style={styles.specs}>{item.specs}</Text>
            <View style={[styles.badge, item.status === 'On Rent' && styles.onRent]}>
              <Text style={styles.badgeText}>{item.status || 'Available'}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', padding: 20, paddingBottom: 10 },
  addButton: {
    backgroundColor: '#374151',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: { color: '#f59e0b', fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nickname: { fontSize: 16, fontWeight: 'bold', color: '#f59e0b' },
  yearMakeModel: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  specs: { fontSize: 14, color: '#9ca3af', marginTop: 2 },
  badge: {
    backgroundColor: '#10b981',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 10,
  },
  onRent: { backgroundColor: '#f59e0b' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});