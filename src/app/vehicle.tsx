import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { currentOwnerId } from '../account';
import { formatDay, formatStamp, loadCachedVehicles, loadCovers, loadRentals, fetchVehicleRentals, rememberCover, saveCachedVehicles, subscribeFleet, vehicleIdLine, type CachedVehicle, type CoverPhoto, type LocalRental } from '../fleet-store';
import { useDisplayUri, warmDisplayUri } from '../media';
import { theme } from '../theme';

type Vehicle = CachedVehicle;

export default function VehicleDetail() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [missing, setMissing] = useState(false);
  const [rentals, setRentals] = useState<LocalRental[]>([]);
  const [cover, setCover] = useState<CoverPhoto | undefined>();
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [showSpecs, setShowSpecs] = useState(false);
  const [facts, setFacts] = useState<VinFacts | null>(null);
  const [factsError, setFactsError] = useState('');
  const [factsLoading, setFactsLoading] = useState(false);
  const [shownCount, setShownCount] = useState(5);
  const [older, setOlder] = useState<LocalRental[]>([]);
  const [olderLoaded, setOlderLoaded] = useState(false);

  useEffect(() => {
    if (!id) {
      setMissing(true);
      return;
    }
    let live = true;
    void loadCachedVehicles().then((saved) => {
      const found = saved.find((item) => item.id === id);
      if (!live || !found) return;
      setVehicle(found);
      if (!editingRef.current) setNickname(found.nickname || '');
      setMissing(false);
    });
    const unsub = onSnapshot(doc(db, 'vehicles', id), (snap) => {
      if (!snap.exists()) {
        if (snap.metadata.fromCache) return;
        setVehicle(null);
        setMissing(true);
        return;
      }
      const data = snap.data() as Omit<Vehicle, 'id'> & { ownerId?: string };
      if (data.ownerId && data.ownerId !== currentOwnerId()) {
        setVehicle(null);
        setMissing(true);
        return;
      }
      const next = { id: snap.id, ...data };
      setVehicle(next);
      if (!editingRef.current) setNickname(data.nickname || '');
      setMissing(false);
      void loadCachedVehicles().then((saved) => {
        const rest = saved.filter((item) => item.id !== next.id);
        return saveCachedVehicles([next, ...rest]);
      });
    }, () => {
      void loadCachedVehicles().then((saved) => {
        if (!live) return;
        if (!saved.some((item) => item.id === id)) setMissing(true);
      });
    });
    return () => {
      live = false;
      unsub();
    };
  }, [id]);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      void (async () => {
        const local = (await loadRentals()).filter((rental) => rental.vehicleId === id);
        if (!live) return;
        setRentals(local);
        const remote = await fetchVehicleRentals(id).catch(() => [] as LocalRental[]);
        if (!live) return;
        setOlder(remote);
        setOlderLoaded(true);
      })();
      void loadCovers().then(async (all) => {
        const found = all.find((item) => item.vehicleId === id);
        if (found) await warmDisplayUri(found.localUri);
        if (live) setCover(found);
      });
    };
    refresh();
    const unsub = subscribeFleet(refresh);
    return () => {
      live = false;
      unsub();
    };
  }, [id]);

  useEffect(() => {
    setShownCount(5);
    setOlder([]);
    setOlderLoaded(false);
  }, [id]);

  useEffect(() => {
    if (!showSpecs || !vehicle?.vin || facts) return;
    const compact = vehicle.vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) return;
    let live = true;
    setFactsLoading(true);
    setFactsError('');
    void lookupVin(vehicle.vin)
      .then((result) => {
        if (live) setFacts(result);
      })
      .catch(() => {
        if (live) setFactsError('Could not look up specs right now.');
      })
      .finally(() => {
        if (live) setFactsLoading(false);
      });
    return () => {
      live = false;
    };
  }, [showSpecs, vehicle?.vin, facts]);

  const open = rentals.find((rental) => rental.status === 'out');
  const onPhone = new Set(rentals.flatMap((rental) => [rental.localId, rental.remoteId].filter((item): item is string => !!item)));
  const combined = [...rentals, ...older.filter((rental) => !onPhone.has(rental.localId) && !(rental.remoteId && onPhone.has(rental.remoteId)))];
  const newestFirst = combined.sort((a, b) => {
    if (a.status === 'out' && b.status !== 'out') return -1;
    if (b.status === 'out' && a.status !== 'out') return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const visibleRentals = newestFirst.slice(0, shownCount);
  const hiddenRentals = newestFirst.length - visibleRentals.length;
  const showMore = hiddenRentals > 0;
  const out = !!open;
  const shop = !out && (vehicle?.status === 'In the shop' || vehicle?.status === 'In Shop');
  const display = useDisplayUri(cover?.localUri, cover?.remoteUrl || vehicle?.photoUrl);

  const setStatus = async (status: string) => {
    if (!id) return;
    if (open && status !== 'Out on rent') return;
    if (!open && status === 'Out on rent') return;
    try {
      await updateDoc(doc(db, 'vehicles', id), { status });
    } catch {
      Alert.alert('Saved locally next time', 'The status could not reach the server. The inspection itself still saves on this phone.');
    }
  };

  const addCover = async () => {
    if (!id) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.92 });
    if (result.canceled || !result.assets[0]) return;
    await rememberCover(id, result.assets[0].uri);
  };

  const saveNickname = async () => {
    const next = nickname.trim();
    if (!id || !next) {
      setNicknameError('Enter a nickname.');
      return;
    }
    try {
      await updateDoc(doc(db, 'vehicles', id), { nickname: next });
      setVehicle((current) => (current ? { ...current, nickname: next } : current));
      setNickname(next);
      setNicknameError('');
      editingRef.current = false;
      setEditing(false);
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : 'Could not save the nickname.');
    }
  };

  if (!vehicle) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingTitle}>{missing ? 'Machine not found' : 'Loading rental files...'}</Text>
        {missing ? null : <Text style={styles.muted}>This machine is opening.</Text>}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {display.uri ? (
        <Image source={{ uri: display.uri }} style={styles.photo} resizeMode="contain" onError={display.failRemote} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.muted}>No photo yet — add one so the crew can spot this machine at a glance.</Text>
        </View>
      )}
      <Pressable style={styles.ghost} onPress={() => void addCover()}>
        <Text style={styles.ghostText}>{display.uri ? 'Change photo' : 'Add photo'}</Text>
      </Pressable>
      {cover?.addedAt || vehicle.photoAddedAt ? <Text style={styles.specs}>Photo added {formatStamp(cover?.addedAt || vehicle.photoAddedAt)}</Text> : null}

      <Text style={styles.nickname}>{vehicle.nickname || 'Untitled'}</Text>
      {vehicle.yearMakeModel ? <Text style={styles.model}>{vehicle.yearMakeModel}</Text> : null}
      {vehicle.vin ? <Text style={styles.vin}>{vehicleIdLine(vehicle.vin)}</Text> : null}

      <View style={[styles.badge, out ? styles.badgeOut : styles.badgeIn]}>
        <Text style={styles.badgeText}>{out ? 'Out on rent' : shop ? 'In the shop' : 'Available'}</Text>
      </View>

      <View style={styles.statusRow}>
        {['Available', 'Out on rent', 'In the shop'].map((status) => {
          const current = out ? 'Out on rent' : shop ? 'In the shop' : 'Available';
          const selected = status === current;
          return (
            <Pressable key={status} style={[styles.statusBtn, selected && styles.statusOn]} onPress={() => void setStatus(status)}>
              <Text style={[styles.statusText, selected && styles.statusTextOn]}>{status}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.pair}>
        <Pressable style={styles.ghost} onPress={() => setShowSpecs((value) => !value)}><Text style={styles.ghostText}>Specs</Text></Pressable>
        <Pressable
          style={styles.ghost}
          onPress={() => {
            const next = !editing;
            editingRef.current = next;
            setNicknameError('');
            if (next) setNickname(vehicle.nickname || '');
            setEditing(next);
          }}
        >
          <Text style={styles.ghostText} numberOfLines={1} adjustsFontSizeToFit>{editing ? 'Cancel' : 'Edit Nickname'}</Text>
        </Pressable>
      </View>
      {showSpecs ? (
        <View style={styles.specCard}>
          {factsLoading ? <Text style={styles.specs}>Looking up this VIN...</Text> : null}
          {factsError ? <Text style={styles.specs}>{factsError}</Text> : null}
          {facts?.rows.map((row) => (
            <View key={row.label} style={styles.specRow}>
              <Text style={styles.specLabel}>{row.label}</Text>
              <Text style={styles.specValue}>{row.value}</Text>
            </View>
          ))}
          {!/^[A-HJ-NPR-Z0-9]{17}$/.test((vehicle.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '')) && !factsLoading ? <Text style={styles.specs}>{vehicle.vin ? 'Specs lookup is for a VIN. The hull number is saved on the card.' : vehicle.specs || 'Add a VIN to look up specs.'}</Text> : null}
        </View>
      ) : null}
      {editing ? (
        <View style={styles.specCard}>
          <Text style={styles.specLabel}>Nickname</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Nickname"
            placeholderTextColor={theme.muted}
            autoFocus
          />
          {nicknameError ? <Text style={styles.nicknameError}>{nicknameError}</Text> : null}
          <Pressable style={styles.save} onPress={() => void saveNickname()}><Text style={styles.saveText}>Save Nickname</Text></Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Rentals & inspections</Text>
      <View style={styles.keepNotice}>
        <Text style={styles.keepNoticeText}>Rental cards, photos, and videos are deleted after one year. Save a card to files if you need to keep it.</Text>
      </View>
      <Pressable
        style={styles.save}
        onPress={() => router.push({ pathname: '/inspection', params: { vehicleId: id, type: out ? 'checkin' : 'checkout' } })}
      >
        <Text style={styles.saveText}>{out ? 'Start return inspection' : 'Start pre-rental inspection'}</Text>
      </Pressable>

      {newestFirst.length === 0 ? <Text style={styles.muted}>{olderLoaded ? 'No rentals yet.' : 'Loading rental files...'}</Text> : visibleRentals.map((rental) => (
        <Pressable key={rental.localId} style={styles.folder} onPress={() => router.push({ pathname: '/rental-history', params: { localId: rental.localId } })}>
          <View style={[styles.folderTab, rental.status !== 'closed' && styles.folderTabOpen]}>
            <Text style={styles.folderTabText} numberOfLines={1}>{rental.renterName || 'Renter'}</Text>
          </View>
          <View style={[styles.folderBody, rental.status !== 'closed' && styles.folderBodyOpen]}>
            <View style={styles.folderMeta}>
              <Text style={styles.specs}>
                Out {formatDay(rental.checkout?.date)}
                {rental.checkin ? ` · Back ${formatDay(rental.checkin.date)}` : ''}
              </Text>
              <Text style={styles.folderStatus}>{rental.status === 'closed' ? 'Returned' : 'Out'}</Text>
            </View>
            <Text style={styles.link}>Details</Text>
            {rental.sync !== 'synced' ? <Text style={styles.waiting}>{rental.syncError && !/expo-file-system|native dependencies|Could not read the saved photo/i.test(rental.syncError) ? rental.syncError : 'Files are saved on this phone, so nothing will be lost. This notice goes away when the photos and video are uploaded to storage. If this was done offline, the upload happens when the internet connection is back.'}</Text> : null}
          </View>
        </Pressable>
      ))}
      {showMore ? (
        <Pressable
          style={styles.more}
          onPress={() => {
            setShownCount((count) => count + 10);
          }}
        >
          <Text style={styles.ghostText}>{`Show the previous ${Math.min(10, hiddenRentals)}`}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  loading: { flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' },
  loadingTitle: { color: theme.text, fontSize: 22, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 48 },
  photo: { width: '100%', height: 220, borderRadius: 16, backgroundColor: theme.input },
  placeholder: { backgroundColor: theme.input, borderRadius: 16, padding: 18 },
  nickname: { color: theme.accent, fontWeight: '800', marginTop: 14, fontSize: 15 },
  nicknameError: { color: theme.danger, marginTop: 8 },
  model: { color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  specs: { color: theme.muted, marginTop: 6, lineHeight: 20 },
  specCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 14, marginTop: 12 },
  specRow: { marginTop: 8 },
  specLabel: { color: theme.muted, fontSize: 12, fontWeight: '700' },
  specValue: { color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  vin: { alignSelf: 'flex-start', backgroundColor: theme.input, color: theme.text, overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  muted: { color: theme.muted, marginTop: 12 },
  keepNotice: { backgroundColor: '#f4e7d6', borderRadius: 12, padding: 12, marginTop: 10 },
  keepNoticeText: { color: theme.ink, fontWeight: '700', lineHeight: 20 },
  badge: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 },
  badgeIn: { backgroundColor: theme.green },
  badgeOut: { backgroundColor: theme.rent },
  badgeText: { color: theme.white, fontWeight: '700' },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusBtn: { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  statusOn: { backgroundColor: theme.ink, borderColor: theme.ink },
  statusText: { color: theme.text, fontWeight: '700', fontSize: 12 },
  statusTextOn: { color: theme.white },
  pair: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ghost: { flex: 1, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 10, backgroundColor: theme.card },
  ghostText: { color: theme.text, fontWeight: '700' },
  input: { backgroundColor: theme.input, borderRadius: 12, padding: 14, marginTop: 8, color: theme.text },
  section: { fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 22 },
  save: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  saveText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  folder: { marginTop: 14 },
  folderTab: { alignSelf: 'flex-start', maxWidth: '78%', marginBottom: -1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderBottomWidth: 0, backgroundColor: '#c4b49a', borderColor: '#b5a588' },
  folderTabOpen: { backgroundColor: '#7ea36a', borderColor: '#5d8648' },
  folderTabText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  folderBody: { backgroundColor: '#d5c7b0', borderWidth: 1, borderColor: '#b5a588', borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 14 },
  folderBodyOpen: { backgroundColor: '#d3ebc4', borderColor: '#5d8648' },
  folderMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  folderStatus: { color: theme.ink, fontWeight: '800', fontSize: 12 },
  more: { borderWidth: 1, borderColor: theme.line, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, backgroundColor: theme.card },
  link: { color: theme.accent, fontWeight: '700', marginTop: 8, textAlign: 'right' },
  waiting: { color: theme.rent, marginTop: 6, fontSize: 13 },
});

type VinFacts = {
  rows: { label: string; value: string }[];
};

function field(row: Record<string, string>, key: string) {
  return String(row[key] || '').trim();
}

async function lookupVin(vin: string): Promise<VinFacts> {
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
  if (!response.ok) throw new Error('lookup failed');
  const data = (await response.json()) as { Results?: Record<string, string>[] };
  const row = data.Results?.[0] || {};
  const liters = Number(field(row, 'DisplacementL'));
  const engineSize = liters
    ? liters >= 1
      ? `${Math.round(liters * 10) / 10}L`
      : `${Math.round(Number(field(row, 'DisplacementCC')) || liters * 1000)} cc`
    : '';
  const engine = [engineSize, field(row, 'EngineCylinders') && `${field(row, 'EngineCylinders')}-cyl`, field(row, 'EngineHP') && `${field(row, 'EngineHP')} hp`, field(row, 'FuelTypePrimary'), field(row, 'EngineConfiguration')].filter(Boolean).join(' · ');
  const transmission = [field(row, 'TransmissionStyle'), field(row, 'TransmissionSpeeds') && `${field(row, 'TransmissionSpeeds')}-speed`].filter(Boolean).join(' · ');
  const built = [field(row, 'PlantCity'), field(row, 'PlantState'), field(row, 'PlantCountry')].filter(Boolean).join(', ');
  const rows = [
    ['Year', field(row, 'ModelYear')],
    ['Make', field(row, 'Make')],
    ['Model', [field(row, 'Model'), field(row, 'Series'), field(row, 'Trim')].filter(Boolean).join(' · ')],
    ['Body', field(row, 'BodyClass')],
    ['Engine', engine],
    ['Drive', field(row, 'DriveType')],
    ['Transmission', transmission],
    ['Weight class', field(row, 'GVWR')],
    ['Brakes', field(row, 'BrakeSystemType')],
    ['Built', built],
    ['Manufacturer', field(row, 'Manufacturer')],
  ].filter((item): item is [string, string] => Boolean(item[1])).map(([label, value]) => ({ label, value }));

  return { rows };
}
