import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { currentOwnerId } from '../../account';
import { loadCachedVehicles, loadCovers, loadRentals, saveCachedVehicles, subscribeFleet, vehicleIdLine, type CachedVehicle, type CoverPhoto, type LocalRental } from '../../fleet-store';
import { useDisplayUri, warmDisplayUri } from '../../media';
import { theme } from '../../theme';

type Vehicle = CachedVehicle;

export default function VehicleListScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<LocalRental[]>([]);
  const [covers, setCovers] = useState<CoverPhoto[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [visit, setVisit] = useState(0);
  useFocusEffect(useCallback(() => setVisit((value) => value + 1), []));

  useEffect(() => {
    let live = true;
    void loadCachedVehicles().then((saved) => {
      const mine = saved.filter((item) => item.ownerId === currentOwnerId());
      if (!live || !mine.length) return;
      setVehicles(mine);
      setSavedIds(mine.map((item) => item.id));
      setReady(true);
    });
    const show = (snapshot: { metadata?: { fromCache?: boolean }; docs: { id: string; data: () => Omit<Vehicle, 'id'> }[] }) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (!next.length && snapshot.metadata?.fromCache) return;
      setVehicles(next);
      setError('');
      setReady(true);
      void saveCachedVehicles(next, !snapshot.metadata?.fromCache).then(() => {
        if (next.length) setSavedIds(next.map((item) => item.id));
      });
    };
    const owned = query(collection(db, 'vehicles'), where('ownerId', '==', currentOwnerId()));
    void getDocs(owned).then(show).catch((err: unknown) => {
      if (!live) return;
      setReady(true);
      void loadCachedVehicles().then((saved) => {
        if (!saved.length) setError(err instanceof Error ? err.message : 'Could not load vehicles');
      });
    });
    const unsub = onSnapshot(
      owned,
      show,
      () => {
        setReady(true);
        void loadCachedVehicles().then((saved) => {
          if (!saved.length) setError('Could not load vehicles');
        });
      }
    );
    return () => {
      live = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      void loadCachedVehicles().then((saved) => {
        if (!saved.length) return;
        setVehicles((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of saved) if (!byId.has(item.id)) byId.set(item.id, item);
          return current.length === byId.size ? current : [...byId.values()];
        });
      });
      void loadRentals().then(setRentals);
      void loadCovers().then(async (next) => {
        await Promise.all(next.map((cover) => warmDisplayUri(cover.localUri)));
        setCovers(next);
      });
    };
    refresh();
    return subscribeFleet(refresh);
  }, []);

  const openInspection = (vehicle: Vehicle, mode: 'checkout' | 'checkin') => {
    router.push({ pathname: '/inspection', params: { vehicleId: vehicle.id, type: mode } });
  };

  return (
    <ScrollView key={visit} style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Rental Log</Text>
      {ready ? <Text style={styles.count}>{vehicles.length} {vehicles.length === 1 ? 'machine' : 'machines'}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!ready && !error ? <Text style={styles.intro}>Loading machines...</Text> : null}
      {ready && vehicles.length === 0 && !error ? <Text style={styles.intro}>No machines yet. Add one to start the fleet.</Text> : null}
      {vehicles.map((vehicle) => {
        const open = rentals.find((rental) => rental.vehicleId === vehicle.id && rental.status === 'out');
        const out = !!open;
        const shop = !out && (vehicle.status === 'In the shop' || vehicle.status === 'In Shop');
        const renter = open?.renterName || vehicle.renterName;
        const cover = covers.find((item) => item.vehicleId === vehicle.id);
        const waiting = !!open && open.sync !== 'synced';
        return (
          <Pressable key={vehicle.id} style={styles.card} onPress={() => router.push({ pathname: '/vehicle', params: { id: vehicle.id } })}>
            <CoverImage localUri={cover?.localUri} remoteUrl={cover?.remoteUrl || vehicle.photoUrl} />
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={styles.nickname}>{vehicle.nickname || 'Untitled'}</Text>
                <View style={[styles.badge, out ? styles.badgeOut : styles.badgeIn]}>
                  <Text style={styles.badgeText}>{out ? 'Out on rent' : shop ? 'In the shop' : 'Available'}</Text>
                </View>
              </View>
              {vehicle.yearMakeModel || (out && renter) ? (
                <View style={styles.modelRow}>
                  <Text style={styles.model}>{vehicle.yearMakeModel || ''}</Text>
                  {out && renter ? <Text style={styles.renter}>{renter}</Text> : null}
                </View>
              ) : null}
              {vehicle.vin ? <Text style={styles.vin}>{vehicleIdLine(vehicle.vin)}</Text> : null}
              {savedIds.includes(vehicle.id) ? <Text style={styles.offline}>Saved on this phone for offline use.</Text> : null}
              <Pressable
                style={styles.action}
                onPress={(event) => {
                  event.stopPropagation();
                  openInspection(vehicle, out ? 'checkin' : 'checkout');
                }}
              >
                <Text style={styles.actionText}>{out ? 'Check in — return inspection' : 'Check out — pre-rental inspection'}</Text>
              </Pressable>
              {waiting ? <Text style={styles.waiting}>Files are saved on this phone, so nothing will be lost. This notice goes away when the photos and video are uploaded to storage. If this was done offline, the upload happens when the internet connection is back.</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CoverImage({ localUri, remoteUrl }: { localUri?: string; remoteUrl?: string }) {
  const display = useDisplayUri(localUri, remoteUrl);
  if (!display.uri) return null;
  return <Image source={{ uri: display.uri }} style={styles.photo} resizeMode="contain" onError={display.failRemote} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 32, fontWeight: '800', color: theme.text },
  intro: { color: theme.muted, marginTop: 8, fontSize: 16, lineHeight: 22 },
  count: { color: theme.text, marginTop: 16, marginBottom: 10, fontWeight: '600' },
  error: { color: theme.danger, marginBottom: 8 },
  card: { backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.line, marginBottom: 14, overflow: 'hidden' },
  photo: { width: '100%', height: 210, backgroundColor: theme.input },
  cardBody: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  nickname: { color: theme.accent, fontWeight: '800', flex: 1, fontSize: 15 },
  model: { color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 4, flex: 1 },
  modelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  renter: { color: theme.text, fontWeight: '700', fontSize: 13, textAlign: 'right', maxWidth: 110, marginTop: 8 },
  vin: { color: theme.muted, marginTop: 2 },
  offline: { color: theme.muted, marginTop: 6, fontSize: 13 },
  action: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', marginTop: 14 },
  actionText: { color: theme.ink, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  waiting: { color: theme.rent, marginTop: 8, fontSize: 13 },
  badge: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  badgeIn: { backgroundColor: theme.green },
  badgeOut: { backgroundColor: theme.rent },
  badgeText: { color: theme.white, fontWeight: '700', fontSize: 12 },
});
