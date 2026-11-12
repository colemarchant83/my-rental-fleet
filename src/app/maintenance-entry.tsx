import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { clocksDisagree, formatDay, formatStamp, loadCachedVehicles, todayIso, type CachedVehicle } from '../fleet-store';
import { deleteMaintenance, loadMaintenanceRecord, saveMaintenance } from '../maintenance-store';
import { OfflineGate } from '../components/offline-gate';
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
  const [serverSavedAt, setServerSavedAt] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      setServerSavedAt(record.serverSavedAt || '');
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

  const saved = !!localId;

  const remove = () => {
    if (!localId) return;
    setDeleting(true);
    setError('');
    void deleteMaintenance(localId)
      .then(() => router.back())
      .catch(() => {
        setDeleting(false);
        setError('Could not delete this record.');
      });
  };

  const name = vehicle?.nickname || vehicle?.yearMakeModel || 'This machine';

  return (
    <OfflineGate>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>{name}</Text>
      {saved ? (
        <>
          <Text style={styles.heading}>{work.trim() || 'Maintenance record'}</Text>
          <Text style={styles.when}>{formatDay(date) || 'No date'}</Text>
          <View style={styles.card}>
            <View style={styles.facts}>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Miles</Text>
                <Text style={styles.factValue}>{miles || '—'}</Text>
              </View>
              <View style={styles.fact}>
                <Text style={styles.factLabel}>Hours</Text>
                <Text style={styles.factValue}>{hours || '—'}</Text>
              </View>
            </View>
            <View style={styles.noteBox}>
              <Text style={styles.factLabel}>Notes</Text>
              <Text style={styles.noteBody}>{notes.trim() || 'No notes'}</Text>
            </View>
            {savedAt ? <Text style={styles.stamp}>Recorded on this phone {formatStamp(savedAt)}</Text> : null}
            {savedAt ? (
              <Text style={styles.stamp}>
                {serverSavedAt
                  ? `Server ${formatStamp(serverSavedAt)}`
                  : 'Server time is recorded when the next internet connection is made.'}
              </Text>
            ) : null}
            {clocksDisagree(savedAt, serverSavedAt) ? <Text style={styles.error}>Phone time does not match the server.</Text> : null}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.heading}>New maintenance record</Text>
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
            placeholder="Detailed description of work performed"
            placeholderTextColor={theme.muted}
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.save} disabled={saving} onPress={save}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save record'}</Text>
          </Pressable>
        </>
      )}
      {saved ? (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.delete} onPress={() => setConfirming(true)}>
            <Text style={styles.deleteText}>Delete this record</Text>
          </Pressable>
          <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.spotTitle}>Delete this record?</Text>
                <Text style={styles.help}>
                  This permanently deletes the {work.trim() || 'maintenance'} record from {formatDay(date)}. Nothing from this record is kept. This cannot be undone.
                </Text>
                <Pressable style={styles.delete} disabled={deleting} onPress={remove}>
                  <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete record'}</Text>
                </Pressable>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable style={styles.cancel} onPress={() => setConfirming(false)} disabled={deleting}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </>
      ) : null}
    </ScrollView>
    </OfflineGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  kicker: { color: theme.accent, fontWeight: '800', fontSize: 15 },
  heading: { color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  when: { color: theme.muted, marginTop: 4, fontWeight: '700' },
  card: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 16, marginTop: 16 },
  facts: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  fact: { flex: 1, backgroundColor: theme.bg, borderRadius: 12, padding: 12 },
  factLabel: { color: theme.muted, fontWeight: '700', fontSize: 13 },
  factValue: { color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  noteBox: { backgroundColor: theme.bg, borderRadius: 12, padding: 12 },
  noteBody: { color: theme.text, marginTop: 6, fontSize: 16, lineHeight: 22 },
  label: { color: theme.muted, fontWeight: '700', marginTop: 16 },
  input: { backgroundColor: theme.input, borderRadius: 12, padding: 14, marginTop: 8, color: theme.text },
  notes: { minHeight: 110, textAlignVertical: 'top' },
  stamp: { color: theme.muted, marginTop: 12 },
  error: { color: theme.danger, marginTop: 12 },
  save: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  saveText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  delete: { marginTop: 22, backgroundColor: theme.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteText: { color: theme.white, fontWeight: '800' },
  cancel: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '700' },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  spotTitle: { fontWeight: '800', color: theme.text, marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
});
