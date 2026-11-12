import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { loadCachedVehicles, saveCachedVehicles } from '../../fleet-store';
import { OfflineGate } from '../../components/offline-gate';
import { theme } from '../../theme';

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
      const vehicle = {
        id: ref.id,
        nickname: nickname.trim(),
        yearMakeModel: yearMakeModel.trim(),
        specs: specs.trim(),
        vin: vin.trim().toUpperCase(),
        status: 'Available',
      };
      const saved = await loadCachedVehicles();
      await saveCachedVehicles([vehicle, ...saved.filter((item) => item.id !== vehicle.id)]);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vehicle');
      setSaving(false);
    }
  };

  return (
    <OfflineGate>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Add Vehicle</Text>
      <Text style={styles.label}>Nickname</Text>
      <TextInput style={styles.input} placeholder="e.g. Dad's truck" placeholderTextColor={theme.muted} value={nickname} onChangeText={setNickname} />
      <Text style={styles.label}>Year, make, model</Text>
      <TextInput style={styles.input} placeholder="e.g. 2004 Dodge 3500" placeholderTextColor={theme.muted} value={yearMakeModel} onChangeText={setYearMakeModel} />
      <Text style={styles.label}>Specs</Text>
      <TextInput style={styles.input} placeholder="e.g. 5.9L · 6-cyl" placeholderTextColor={theme.muted} value={specs} onChangeText={setSpecs} />
      <Text style={styles.label}>VIN</Text>
      <TextInput style={styles.input} placeholder="Enter VIN" placeholderTextColor={theme.muted} value={vin} onChangeText={setVin} autoCapitalize="characters" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.save} onPress={() => void saveVehicle()} disabled={saving}>
        {saving ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.saveText}>Save Vehicle</Text>}
      </Pressable>
    </ScrollView>
    </OfflineGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 32, fontWeight: '800', color: theme.text, marginBottom: 8 },
  label: { color: theme.text, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: theme.input, color: theme.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  error: { color: theme.danger, marginTop: 12 },
  save: { backgroundColor: theme.action, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { color: theme.ink, fontWeight: '800', fontSize: 17 },
});
