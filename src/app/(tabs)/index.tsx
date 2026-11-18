import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { currentOwnerId } from '../../account';
import { loadCachedVehicles, loadCovers, loadRentals, fetchOpenRentals, fetchVehicleRentals, forgetRentalsRemovedElsewhere, isOutStatus, mergeRentalLists, openRentalFor, reconcilePhoneRentals, rememberRentals, rentalIsReturned, saveCachedVehicles, savedOpenRentals, settleVehicleRentalStatus, subscribeFleet, vehicleIdLine, type CachedVehicle, type CoverPhoto, type LocalRental } from '../../fleet-store';
import { useDisplayUri, warmDisplayUri } from '../../media';
import { theme } from '../../theme';

type Vehicle = CachedVehicle;

export default function VehicleListScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<LocalRental[]>([]);
  const [rentalsReady, setRentalsReady] = useState(false);
  const [covers, setCovers] = useState<CoverPhoto[]>([]);
  const [error, setError] = useState('');
  const [returnNote, setReturnNote] = useState('');
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
        const mine = saved.filter((item) => item.ownerId === currentOwnerId());
        if (!mine.length) return;
        setVehicles((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          let changed = false;
          for (const item of mine) {
            const existing = byId.get(item.id);
            if (!existing) {
              byId.set(item.id, item);
              changed = true;
              continue;
            }
            if ((isOutStatus(item.status) || item.renterName) && (!isOutStatus(existing.status) || existing.renterName !== item.renterName)) {
              byId.set(item.id, { ...existing, status: item.status, renterName: item.renterName });
              changed = true;
            }
          }
          return changed ? [...byId.values()] : current;
        });
      });
      void (async () => {
        const local = mergeRentalLists(await loadRentals(), await savedOpenRentals());
        setRentals(local);
        try {
          const remote = await fetchOpenRentals();
          let merged = await reconcilePhoneRentals(remote);
          const openVehicleIds = [...new Set(merged.filter((rental) => !rentalIsReturned(rental)).map((rental) => rental.vehicleId))];
          for (const vehicleId of openVehicleIds) {
            const history = await fetchVehicleRentals(vehicleId).catch(() => null);
            if (!history) continue;
            if (!history.length) continue;
            await forgetRentalsRemovedElsewhere(vehicleId, history);
            await rememberRentals(history);
            const local = (await loadRentals()).filter((rental) => rental.vehicleId === vehicleId);
            merged = [...merged.filter((rental) => rental.vehicleId !== vehicleId), ...mergeRentalLists(local, history)];
          }
          setRentals(merged);
        } catch {
          // Keep the rentals already on this phone when the server cannot be reached.
        }
        setRentalsReady(true);
      })();
      void loadCovers().then(async (next) => {
        await Promise.all(next.map((cover) => warmDisplayUri(cover.localUri)));
        setCovers(next);
      });
    };
    refresh();
    return subscribeFleet(refresh);
  }, []);

  useEffect(() => {
    if (!rentalsReady) return;
    for (const vehicle of vehicles) {
      if (!isOutStatus(vehicle.status) && !vehicle.renterName) continue;
      void settleVehicleRentalStatus(vehicle.id, vehicle);
    }
  }, [rentalsReady, vehicles]);

  const openInspection = (vehicle: Vehicle, mode: 'checkout' | 'checkin') => {
    if (mode !== 'checkin') {
      setReturnNote('');
      router.push({ pathname: '/inspection', params: { vehicleId: vehicle.id, type: mode } });
      return;
    }
    const have = rentals.some((rental) => rental.vehicleId === vehicle.id && !rentalIsReturned(rental));
    const go = (ok: boolean) => {
      if (!ok) {
        setReturnNote('This phone does not have that rental card yet. Open the app once with service and wait until the renter name shows. Then the return can be saved with no service.');
        return;
      }
      setReturnNote('');
      router.push({ pathname: '/inspection', params: { vehicleId: vehicle.id, type: mode } });
    };
    if (have) {
      go(true);
      return;
    }
    void openRentalFor(vehicle.id).then((rental) => go(!!rental));
  };

  return (
    <ScrollView key={visit} style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Rentals</Text>
      {ready ? <Text style={styles.count}>{vehicles.length} {vehicles.length === 1 ? 'machine' : 'machines'}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {returnNote ? <Text style={styles.error}>{returnNote}</Text> : null}
      {!ready && !error ? <Text style={styles.intro}>Loading machines...</Text> : null}
      {ready && vehicles.length === 0 && !error ? <Text style={styles.intro}>No machines yet. Add one to start the fleet.</Text> : null}
      {vehicles.map((vehicle) => {
        const open = rentals.find((rental) => rental.vehicleId === vehicle.id && !rentalIsReturned(rental));
        const recordedOut = isOutStatus(vehicle.status) || !!vehicle.renterName;
        const out = !!open || recordedOut;
        const shop = !out && (vehicle.status === 'In the shop' || vehicle.status === 'In Shop');
        const renter = open?.renterName || (recordedOut ? vehicle.renterName : undefined);
        const cover = covers.find((item) => item.vehicleId === vehicle.id);
        const waiting = !!open && open.sync !== 'synced';
        return (
          <Pressable key={vehicle.id} style={styles.card} onPress={() => router.push({ pathname: '/vehicle', params: { id: vehicle.id } })}>
            <CoverImage localUri={cover?.localUri} remoteUrl={cover?.remoteUrl || vehicle.photoUrl} />
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={styles.nickname}>{vehicle.nickname || 'Untitled'}</Text>
                <View style={[styles.badge, out ? styles.badgeOut : shop ? styles.badgeShop : styles.badgeIn]}>
                  <Text style={[styles.badgeText, shop && !out && styles.badgeShopText]}>{!rentalsReady && !out ? 'Checking' : out ? 'Out on rent' : shop ? 'In the shop' : 'Available'}</Text>
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
                style={[styles.action, !rentalsReady && !out && styles.actionWait]}
                disabled={!rentalsReady && !out}
                onPress={(event) => {
                  event.stopPropagation();
                  if (!rentalsReady && !out) return;
                  openInspection(vehicle, out ? 'checkin' : 'checkout');
                }}
              >
                <Text style={styles.actionText}>{!rentalsReady && !out ? 'Checking rental...' : out ? 'Check in — return inspection' : 'Check out — pre-rental inspection'}</Text>
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
  return <Image key={display.attempt} source={{ uri: display.uri }} style={styles.photo} resizeMode="contain" onError={display.failRemote} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 38, fontWeight: '800', color: theme.text, textAlign: 'center' },
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
  actionWait: { opacity: 0.7 },
  actionText: { color: theme.ink, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  waiting: { color: theme.rent, marginTop: 8, fontSize: 13 },
  badge: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  badgeIn: { backgroundColor: theme.green },
  badgeShop: { backgroundColor: '#eab308' },
  badgeOut: { backgroundColor: theme.rent },
  badgeText: { color: theme.white, fontWeight: '700', fontSize: 12 },
  badgeShopText: { color: '#1c1917' },
});
