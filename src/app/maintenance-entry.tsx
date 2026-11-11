import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatStamp, loadCachedVehicles, todayIso, type CachedVehicle } from '../fleet-store';
import { loadMaintenanceRecord, saveMaintenance } from '../maintenance-store';
import { theme } from '../theme';

export default function MaintenanceEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string | string[]; localId?: string | string[] }>();
  const vehicleId = Array.isArray(params.vehicleId) ? params.vehicleId[0] : params.vehicleId;
  const localId = Array.isArray(params.localId) ? params.localId[0] : params.localId;
  const [vehicle, setVehicle] = useState<CachedVehicle | null>(null);
  const [date, setDate] = useState(todayIso());
  const [work, setWork] = useState('');
  const [miles, setMiles] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadCachedVehicles().then((vehicles) => {
      setVehicle(vehicles.find((item) => item.id === vehicleId) ?? null);
    });
    if (!localId) return;
    void loadMaintenanceRecord(localId).then((record) => {
      if (!record) return;
      setDate(record.date);
      setWork(record.work);
      setMiles(record.miles || '');
      setHours(record.hours || '');
      setNotes(record.notes);
      setSavedAt(record.savedAt);
    });
  }, [vehicleId, localId]);

  const save = () => {
    if (!vehicleId) return;
    if (!work.trim()) {
      setError('Add what was done before saving.');
      return;
    }
    if (!miles.trim() && !hours.trim()) {
      setError('Enter miles or hours before saving. One of them is required.');
      return;
    }
    setSaving(true);
    setError('');
    void saveMaintenance({ localId, vehicleId, date: date || todayIso(), work, notes, miles, hours })
      .then(() => router.back())
      .catch(() => setError('Could not save this record.'))
      .finally(() => setSaving(false));
  };

  const name = vehicle?.nickname || vehicle?.yearMakeModel || 'This machine';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>{name}</Text>
      <Text style={styles.heading}>{localId ? 'Maintenance record' : 'New maintenance record'}</Text>
      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.muted} />
      <Text style={styles.label}>What was done</Text>
      <TextInput style={styles.input} value={work} onChangeText={setWork} placeholder="Oil change, tire repair..." placeholderTextColor={theme.muted} />
      <Text style={styles.label}>Miles</Text>
      <TextInput style={styles.input} value={miles} onChangeText={setMiles} placeholder="Miles" placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
      <Text style={styles.label}>Hours</Text>
      <TextInput style={styles.input} value={hours} onChangeText={setHours} placeholder="Hours" placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notes]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Parts, hours, anything worth keeping"
        placeholderTextColor={theme.muted}
        multiline
      />
      {savedAt ? <Text style={styles.stamp}>Saved {formatStamp(savedAt)}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.save} disabled={saving} onPress={save}>
        <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save record'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  kicker: { color: theme.accent, fontWeight: '800', fontSize: 15 },
  heading: { color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  label: { color: theme.muted, fontWeight: '700', marginTop: 16 },
  input: { backgroundColor: theme.input, borderRadius: 12, padding: 14, marginTop: 8, color: theme.text },
  notes: { minHeight: 110, textAlignVertical: 'top' },
  stamp: { color: theme.muted, marginTop: 12 },
  error: { color: theme.danger, marginTop: 12 },
  save: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  saveText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
});
