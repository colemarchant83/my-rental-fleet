import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDay, formatStamp, loadCovers, loadRentals, rememberCover, subscribeFleet, type CoverPhoto, type LocalRental } from '../fleet-store';
import { useDisplayUri } from '../media';
import { theme } from '../theme';

type Vehicle = {
  id: string;
  nickname?: string;
  yearMakeModel?: string;
  specs?: string;
  vin?: string;
  status?: string;
  renterName?: string;
  photoUrl?: string;
  photoAddedAt?: string;
};

export default function VehicleDetail() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [missing, setMissing] = useState(false);
  const [rentals, setRentals] = useState<LocalRental[]>([]);
  const [cover, setCover] = useState<CoverPhoto | undefined>();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [showSpecs, setShowSpecs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'vehicles', id), (snap) => {
      if (!snap.exists()) {
        setVehicle(null);
        setMissing(true);
        return;
      }
      const data = snap.data() as Omit<Vehicle, 'id'>;
      setVehicle({ id: snap.id, ...data });
      setNickname(data.nickname || '');
      setMissing(false);
    });
  }, [id]);

  useEffect(() => {
    const refresh = () => {
      void loadRentals().then((all) => setRentals(all.filter((rental) => rental.vehicleId === id)));
      void loadCovers().then((all) => setCover(all.find((item) => item.vehicleId === id)));
    };
    refresh();
    return subscribeFleet(refresh);
  }, [id]);

  const open = rentals.find((rental) => rental.status === 'out');
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
    if (!id || !nickname.trim()) return;
    await updateDoc(doc(db, 'vehicles', id), { nickname: nickname.trim() });
    setEditing(false);
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!id) return;
    await deleteDoc(doc(db, 'vehicles', id));
    router.back();
  };

  if (!vehicle) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{missing ? 'Machine not found' : 'Loading...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {display.uri ? (
        <Image source={{ uri: display.uri }} style={styles.photo} onError={display.failRemote} />
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
      {vehicle.specs ? <Text style={styles.specs}>{vehicle.specs}</Text> : null}
      {vehicle.vin ? <Text style={styles.vin}>VIN {vehicle.vin}</Text> : null}

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
        <Pressable style={styles.ghost} onPress={() => setShowSpecs((value) => !value)}><Text style={styles.ghostText}>Specs & recalls</Text></Pressable>
        <Pressable style={styles.ghost} onPress={() => setEditing((value) => !value)}><Text style={styles.ghostText}>Edit nickname</Text></Pressable>
      </View>
      {showSpecs ? <Text style={styles.specs}>{vehicle.specs || 'No specs saved yet.'}</Text> : null}
      {editing ? (
        <View>
          <TextInput style={styles.input} value={nickname} onChangeText={setNickname} />
          <Pressable style={styles.save} onPress={() => void saveNickname()}><Text style={styles.saveText}>Save nickname</Text></Pressable>
        </View>
      ) : null}

      <Text style={styles.section}>Rentals & inspections</Text>
      <Pressable
        style={styles.save}
        onPress={() => router.push({ pathname: '/inspection', params: { vehicleId: id, type: out ? 'checkin' : 'checkout' } })}
      >
        <Text style={styles.saveText}>{out ? 'Start return inspection' : 'Start pre-rental inspection'}</Text>
      </Pressable>

      {rentals.length === 0 ? <Text style={styles.muted}>No rentals yet.</Text> : rentals.map((rental) => (
        <Pressable key={rental.localId} style={styles.rental} onPress={() => router.push({ pathname: '/rental-history', params: { localId: rental.localId } })}>
          <View style={styles.titleRow}>
            <Text style={styles.renter}>{rental.renterName}</Text>
            <View style={styles.closed}><Text style={styles.closedText}>{rental.status === 'closed' ? 'Returned' : 'Out'}</Text></View>
          </View>
          <Text style={styles.specs}>
            Out {formatDay(rental.checkout.date)}
            {rental.checkin ? ` · Back ${formatDay(rental.checkin.date)}` : ''}
          </Text>
          <Text style={styles.link}>Details</Text>
          {rental.syncError && !/expo-file-system|native dependencies|Could not read the saved photo/i.test(rental.syncError) ? <Text style={styles.waiting}>{rental.syncError}</Text> : null}
        </Pressable>
      ))}

      <Pressable onPress={() => void remove()}>
        <Text style={styles.remove}>{confirmDelete ? 'Tap again to remove from fleet' : 'Remove from fleet'}</Text>
      </Pressable>
      {Platform.OS === 'web' ? <View style={{ height: 24 }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  photo: { width: '100%', height: 220, borderRadius: 16, backgroundColor: theme.input },
  placeholder: { backgroundColor: theme.input, borderRadius: 16, padding: 18 },
  nickname: { color: theme.accent, fontWeight: '800', marginTop: 14, fontSize: 15 },
  model: { color: theme.text, fontSize: 28, fontWeight: '800', marginTop: 2 },
  specs: { color: theme.muted, marginTop: 6, lineHeight: 20 },
  vin: { alignSelf: 'flex-start', backgroundColor: theme.input, color: theme.text, overflow: 'hidden', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  muted: { color: theme.muted, marginTop: 12 },
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
  rental: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 14, marginTop: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  renter: { color: theme.text, fontSize: 18, fontWeight: '800' },
  closed: { backgroundColor: theme.input, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  closedText: { color: theme.text, fontWeight: '700', fontSize: 12 },
  link: { color: theme.accent, fontWeight: '700', marginTop: 8, textAlign: 'right' },
  waiting: { color: theme.rent, marginTop: 6, fontSize: 13 },
  remove: { color: theme.danger, fontWeight: '700', marginTop: 28 },
});
