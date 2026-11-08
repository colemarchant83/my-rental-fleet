import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

export default function AddScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [yearMakeModel, setYearMakeModel] = useState('');
  const [specs, setSpecs] = useState('');
  const [vin, setVin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveVehicle = async () => {
    if (!nickname.trim() || !vin.trim()) {
      setError('Enter a nickname and VIN');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const ref = await addDoc(collection(db, 'vehicles'), {
        nickname: nickname.trim(),
        yearMakeModel: yearMakeModel.trim(),
        specs: specs.trim(),
        vin: vin.trim().toUpperCase(),
        status: 'Available',
        createdAt: serverTimestamp(),
      });
      router.replace(`/vehicle?id=${ref.id}`);
    } catch (e: any) {
      setError(e?.message || 'Could not save vehicle');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Vehicle</Text>

      <Text style={styles.label}>Nickname</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Dad's truck"
        placeholderTextColor="#6b7280"
        value={nickname}
        onChangeText={setNickname}
      />

      <Text style={styles.label}>Year, make, model</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 2004 Dodge 3500"
        placeholderTextColor="#6b7280"
        value={yearMakeModel}
        onChangeText={setYearMakeModel}
      />

      <Text style={styles.label}>Specs</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 4x4, diesel"
        placeholderTextColor="#6b7280"
        value={specs}
        onChangeText={setSpecs}
      />

      <Text style={styles.label}>VIN</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter VIN"
        placeholderTextColor="#6b7280"
        value={vin}
        onChangeText={setVin}
        autoCapitalize="characters"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={saveVehicle} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.saveButtonText}>Save Vehicle</Text>
        )}
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
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#e5e7eb',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#374151',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
  },
  error: {
    color: '#fca5a5',
    marginTop: 16,
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    minHeight: 54,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
