import { useCallback, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { clocksDisagree, formatDay, formatStamp, loadCachedVehicles, loadCovers, type CachedVehicle } from '../fleet-store';
import { loadMaintenance, type MaintenanceRecord } from '../maintenance-store';
import { useDisplayUri } from '../media';
import { OfflineGate } from '../components/offline-gate';
import { theme } from '../theme';

export default function MaintenanceRecordScreen({ vehicleId: vehicleIdProp }: { vehicleId?: string } = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const paramId = Array.isArray(params.vehicleId) ? params.vehicleId[0] : params.vehicleId;
  const vehicleId = vehicleIdProp || paramId;
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [vehicle, setVehicle] = useState<CachedVehicle | null>(null);
  const [cover, setCover] = useState<{ localUri?: string; remoteUrl?: string }>({});
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [shown, setShown] = useState(5);
  const photo = useDisplayUri(cover.localUri, cover.remoteUrl || vehicle?.photoUrl);

  const load = useCallback(() => {
    void loadCachedVehicles().then((vehicles) => {
      setVehicle(vehicles.find((item) => item.id === vehicleId) ?? null);
    });
    void loadCovers().then((covers) => {
      const found = covers.find((item) => item.vehicleId === vehicleId);
      setCover({ localUri: found?.localUri, remoteUrl: found?.remoteUrl });
    });
    if (!vehicleId) return;
    void loadMaintenance(vehicleId).then(setRecords);
  }, [vehicleId]);

  useFocusEffect(load);

  const name = vehicle?.nickname || vehicle?.yearMakeModel || 'This machine';
  const visible = records.slice(0, shown);
  const hidden = Math.max(0, records.length - shown);

  return (
    <OfflineGate>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {desktop && photo.uri ? <Image key={photo.attempt} source={{ uri: photo.uri }} style={styles.photo} resizeMode="contain" onError={photo.failRemote} /> : null}
      {vehicle?.nickname && vehicle?.yearMakeModel ? <Text style={styles.kicker}>{vehicle.yearMakeModel}</Text> : null}
      <Text style={styles.model}>{vehicle?.nickname || vehicle?.yearMakeModel || name}</Text>
      <Pressable
        style={styles.newButton}
        onPress={() => router.push({ pathname: '/maintenance-entry', params: { vehicleId: vehicleId || '' } })}
      >
        <Text style={styles.newText}>New maintenance record</Text>
      </Pressable>
      <Text style={styles.section}>Records</Text>
      {records.length === 0 ? <Text style={styles.muted}>No maintenance records yet.</Text> : null}
      {visible.map((record) => (
        <Pressable
          key={record.localId}
          style={styles.folder}
          onPress={() => router.push({ pathname: '/maintenance-entry', params: { vehicleId: record.vehicleId, localId: record.localId } })}
        >
          <View style={styles.folderTab}>
            <Text style={styles.folderTabText} numberOfLines={1}>{record.work || 'Maintenance'}</Text>
          </View>
          <View style={styles.folderBody}>
            <Text style={styles.date}>{formatDay(record.date) || 'No date'}</Text>
            <Text style={styles.date}>Miles {record.miles || '—'} · Hours {record.hours || '—'}{record.cost ? ` · ${record.cost.startsWith('$') ? record.cost : `$${record.cost}`}` : ''}</Text>
            <Text style={styles.date}>Phone {formatStamp(record.savedAt)}</Text>
            <Text style={styles.date}>{record.serverSavedAt ? `Server ${formatStamp(record.serverSavedAt)}` : 'Server time is recorded when the next internet connection is made.'}</Text>
            {clocksDisagree(record.savedAt, record.serverSavedAt) ? <Text style={styles.warn}>Phone time does not match the server. Inspection may have been done offline.</Text> : null}
            {record.notes ? <Text style={styles.notes} numberOfLines={2}>{record.notes}</Text> : null}
            {record.photos?.length ? <Text style={styles.date}>{record.photos.length === 1 ? '1 photo' : `${record.photos.length} photos`}</Text> : null}
            <Text style={styles.link}>Details</Text>
          </View>
        </Pressable>
      ))}
      {hidden > 0 ? (
        <Pressable style={styles.more} onPress={() => setShown((count) => count + 10)}>
          <Text style={styles.moreText}>Show the previous {Math.min(10, hidden)}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
    </OfflineGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  photo: { width: '100%', height: 240, borderRadius: 16, backgroundColor: 'transparent', marginBottom: 12 },
  kicker: { color: theme.accent, fontWeight: '800', fontSize: 15 },
  model: { color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  newButton: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  newText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  section: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 22 },
  muted: { color: theme.muted, marginTop: 12 },
  folder: { marginTop: 14 },
  folderTab: { alignSelf: 'flex-start', maxWidth: '78%', marginBottom: -1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderBottomWidth: 0, backgroundColor: '#c4b49a', borderColor: '#b5a588' },
  folderTabText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  folderBody: { backgroundColor: '#d5c7b0', borderWidth: 1, borderColor: '#b5a588', borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 14 },
  date: { color: theme.muted, lineHeight: 20 },
  warn: { color: theme.danger, marginTop: 6, fontWeight: '700' },
  notes: { color: theme.text, marginTop: 6 },
  link: { color: theme.accent, fontWeight: '700', marginTop: 8, textAlign: 'right' },
  more: { borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: theme.card },
  moreText: { color: theme.text, fontWeight: '700' },
});
