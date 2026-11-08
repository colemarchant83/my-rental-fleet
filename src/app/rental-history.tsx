import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ZoomModal } from '../components/zoom-modal';
import { useDisplayUri } from '../media';
import { SPOTS, deleteRental, formatDay, formatStamp, loadRentals, rentalByLocalId, subscribeFleet, type InspectionSide, type LocalRental } from '../fleet-store';
import { theme } from '../theme';

type RemotePhoto = string | { url?: string; addedAt?: string };
type RemoteSpot = { status?: string; note?: string; notedAt?: string; photos?: RemotePhoto[] };

export default function RentalHistory() {
  const params = useLocalSearchParams<{ localId?: string; id?: string }>();
  const router = useRouter();
  const [rental, setRental] = useState<LocalRental | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const refresh = async () => {
      if (params.localId) {
        setRental((await rentalByLocalId(params.localId)) ?? null);
        return;
      }
      if (!params.id) return;
      const local = (await loadRentals()).find((item) => item.remoteId === params.id);
      if (local) {
        setRental(local);
        return;
      }
      const snap = await getDoc(doc(db, 'rentals', params.id));
      if (!snap.exists()) return;
      setRental(fromRemote(params.id, snap.data() as Record<string, unknown>));
    };
    void refresh();
    return subscribeFleet(() => void refresh());
  }, [params.localId, params.id]);

  if (!rental) {
    return <View style={styles.screen}><Text style={styles.muted}>Loading rental...</Text></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.renter}>{rental.renterName || 'Renter'}</Text>
        <View style={styles.pill}><Text style={styles.pillText}>{rental.status === 'closed' ? 'Closed' : 'Out'}</Text></View>
      </View>
      <Text style={styles.muted}>
        Out {formatDay(rental.checkout.date)}
        {rental.checkin ? ` · Back ${formatDay(rental.checkin.date)}` : ''}
      </Text>
      {rental.checkout.savedAt ? <Text style={styles.stampLine}>Checkout recorded {formatStamp(rental.checkout.savedAt)}</Text> : null}
      {rental.checkin?.savedAt ? <Text style={styles.stampLine}>Return recorded {formatStamp(rental.checkin.savedAt)}</Text> : null}
      {rental.sync !== 'synced' && !(rental.syncError && /expo-file-system|native dependencies|Could not read the saved photo/i.test(rental.syncError)) ? (
        <Text style={styles.waiting}>Saved on this phone. {rental.syncError || 'Photos upload when you have service.'}</Text>
      ) : null}

      <View style={styles.stats}>
        <Stat label="Fuel out" value={rental.checkout.fuel} />
        <Stat label="Miles out" value={rental.checkout.miles || '—'} />
        <Stat label="Hours out" value={rental.checkout.hours || '—'} />
      </View>

      {SPOTS.map((spot) => {
        const out = rental.checkout.spots[spot.id];
        const back = rental.checkin?.spots[spot.id];
        return (
          <View key={spot.id} style={styles.spot}>
            <Text style={styles.spotTitle}>{spot.label}</Text>
            <View style={styles.compare}>
              <View style={styles.sideCol}>
                <Text style={styles.sideLabel}>Check out</Text>
                <PhotoStack photos={photosOf(rental.checkout, spot.id)} empty="No photo" onOpen={setZoom} />
                <View style={styles.noteBox}>
                  <Text style={out.note.trim() ? styles.noteText : styles.noteEmpty}>{out.note.trim() || 'No note'}</Text>
                  {out.note.trim() && out.notedAt ? <Text style={styles.noteWhen}>{formatStamp(out.notedAt)}</Text> : null}
                </View>
                <Text style={styles.state}>{labelStatus(out.status)}</Text>
              </View>
              <View style={styles.sideCol}>
                <Text style={styles.sideLabel}>Check in</Text>
                <PhotoStack photos={rental.checkin ? photosOf(rental.checkin, spot.id) : []} empty={rental.checkin ? 'No photo' : 'Not returned yet'} onOpen={setZoom} />
                <View style={styles.noteBox}>
                  <Text style={back?.note.trim() ? styles.noteText : styles.noteEmpty}>{back?.note.trim() || 'No note'}</Text>
                  {back?.note.trim() && back.notedAt ? <Text style={styles.noteWhen}>{formatStamp(back.notedAt)}</Text> : null}
                </View>
                <Text style={styles.state}>{rental.checkin ? labelStatus(back?.status || '') : '—'}</Text>
              </View>
            </View>
          </View>
        );
      })}

      {rental.checkout.videoUri || rental.checkout.videoUrl ? <Text style={styles.stampLine}>Checkout video added {formatStamp(rental.checkout.videoAddedAt)}</Text> : null}
      {rental.checkin?.videoUri || rental.checkin?.videoUrl ? <Text style={styles.stampLine}>Return video added {formatStamp(rental.checkin.videoAddedAt)}</Text> : null}
      {rental.checkout.notes ? <Text style={styles.notes}>Checkout notes · {formatStamp(rental.checkout.notesAt)}{'\n'}{rental.checkout.notes}</Text> : null}
      {rental.checkin?.notes ? <Text style={styles.notes}>Return notes · {formatStamp(rental.checkin.notesAt)}{'\n'}{rental.checkin.notes}</Text> : null}
      <Pressable style={styles.delete} onPress={() => setConfirming(true)}>
        <Text style={styles.deleteText}>Delete this rental</Text>
      </Pressable>
      <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.spotTitle}>Delete this rental?</Text>
            <Text style={styles.help}>
              This permanently deletes {rental.renterName || 'this renter'}'s rental from {formatDay(rental.checkout.date)}, including the notes and every photo and video stored for this rental. Nothing from this card is kept. This cannot be undone.
            </Text>
            <Pressable
              style={styles.delete}
              disabled={deleting}
              onPress={() => {
                setDeleting(true);
                setDeleteError('');
                void deleteRental(rental)
                  .then(() => router.back())
                  .catch((error: unknown) => {
                    setDeleting(false);
                    setDeleteError(error instanceof Error ? error.message : 'Could not delete the stored photo.');
                  });
              }}
            >
              <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete rental'}</Text>
            </Pressable>
            {deleteError ? <Text style={styles.deleteError}>{deleteError}</Text> : null}
            <Pressable style={styles.cancel} onPress={() => setConfirming(false)} disabled={deleting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ZoomModal uri={zoom} onClose={() => setZoom(null)} />
    </ScrollView>
  );
}

type StampedPhoto = { localUri?: string; remoteUrl?: string; addedAt?: string };

function photosOf(side: InspectionSide, spotId: (typeof SPOTS)[number]['id']): StampedPhoto[] {
  return side.spots[spotId].photos
    .map((photo) => ({ localUri: photo.localUri, remoteUrl: photo.remoteUrl, addedAt: photo.addedAt }))
    .filter((photo) => photo.localUri || photo.remoteUrl);
}

function labelStatus(status: string) {
  if (status === 'issue') return 'Issue';
  if (status === 'ok') return 'OK';
  return '—';
}

function HistoryPhoto({ photo, style, onOpen, empty }: { photo: StampedPhoto; style: object; onOpen: (uri: string) => void; empty: string }) {
  const display = useDisplayUri(photo.localUri, photo.remoteUrl);
  if (!display.uri) {
    if (!empty) return null;
    return <View style={styles.frame}><Text style={styles.empty}>{empty}</Text></View>;
  }
  return (
    <View>
      <Pressable onPress={() => onOpen(display.uri)}>
        <Image source={{ uri: display.uri }} style={style} resizeMode="cover" onError={display.failRemote} />
        <Text pointerEvents="none" style={styles.enlarge}>Enlarge</Text>
      </Pressable>
      {photo.addedAt ? <Text style={styles.photoStamp}>{formatStamp(photo.addedAt)}</Text> : null}
    </View>
  );
}

function PhotoStack({ photos, empty, onOpen }: { photos: StampedPhoto[]; empty: string; onOpen: (uri: string) => void }) {
  if (!photos.length) {
    return <View style={styles.frame}><Text style={styles.empty}>{empty}</Text></View>;
  }
  return (
    <View style={styles.sideCol}>
      <HistoryPhoto photo={photos[0]} style={styles.shot} onOpen={onOpen} empty={empty} />
      {photos.length > 1 ? (
        <View style={styles.extraRow}>
          {photos.slice(1).map((photo, index) => (
            <View key={`${photo.localUri ?? ''}-${photo.remoteUrl ?? ''}-${index}`}>
              <HistoryPhoto photo={photo} style={styles.extra} onOpen={onOpen} empty="" />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function NoteLine({ label, note, at }: { label: string; note: string; at?: string }) {
  if (!note.trim()) return null;
  return <Text style={styles.noteLine}>{label}: {note}{at ? ` · ${formatStamp(at)}` : ''}</Text>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function fromRemote(remoteId: string, data: Record<string, unknown>): LocalRental {
  const checkout = (data.checkout ?? {}) as Partial<InspectionSide> & { spots?: Record<string, RemoteSpot> };
  const checkinRaw = data.checkin as (Partial<InspectionSide> & { spots?: Record<string, RemoteSpot> }) | null;
  return {
    localId: String(data.localId || remoteId),
    remoteId,
    vehicleId: String(data.vehicleId || ''),
    renterName: String(data.renterName || ''),
    status: data.status === 'Checked In' || checkinRaw ? 'closed' : 'out',
    sync: 'synced',
    createdAt: Date.now(),
    checkout: sideFrom(checkout, String(data.checkoutDate || '')),
    checkin: checkinRaw ? sideFrom(checkinRaw, String(data.checkinDate || '')) : undefined,
  };
}

function sideFrom(raw: { date?: string; fuel?: string; miles?: string; hours?: string; notes?: string; notesAt?: string; savedAt?: string; videoAddedAt?: string; videoUrl?: string; spots?: Record<string, RemoteSpot> }, fallbackDate: string): InspectionSide {
  const spots = {} as InspectionSide['spots'];
  for (const spot of SPOTS) {
    const found = raw.spots?.[spot.id];
    spots[spot.id] = {
      status: found?.status === 'issue' ? 'issue' : found?.status === 'ok' ? 'ok' : '',
      note: found?.note || '',
      notedAt: found?.notedAt,
      photos: (found?.photos || []).map((photo, index) => {
        const url = typeof photo === 'string' ? photo : photo.url || '';
        const addedAt = typeof photo === 'string' ? undefined : photo.addedAt;
        return { id: `${spot.id}-${index}`, localUri: url, remoteUrl: url, addedAt };
      }).filter((photo) => photo.remoteUrl),
    };
  }
  return {
    date: raw.date || fallbackDate,
    fuel: raw.fuel || 'Not recorded',
    miles: raw.miles || '',
    hours: raw.hours || '',
    notes: raw.notes || '',
    notesAt: raw.notesAt,
    savedAt: raw.savedAt,
    videoUrl: raw.videoUrl,
    videoAddedAt: raw.videoAddedAt,
    spots,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  renter: { fontSize: 28, fontWeight: '800', color: theme.text, flex: 1 },
  pill: { backgroundColor: theme.input, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontWeight: '700', color: theme.text },
  muted: { color: theme.muted, marginTop: 6 },
  waiting: { color: theme.rent, marginTop: 8 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.line },
  statLabel: { color: theme.muted, fontSize: 12 },
  statValue: { color: theme.text, fontWeight: '700', marginTop: 2 },
  section: { fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 20, marginBottom: 8 },
  spot: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 12, marginBottom: 12 },
  spotTitle: { fontWeight: '800', color: theme.text, marginBottom: 8 },
  compare: { flexDirection: 'row', gap: 8 },
  sideCol: { flex: 1 },
  sideLabel: { color: theme.text, fontWeight: '800', fontSize: 13, marginBottom: 6 },
  noteBox: { marginTop: 6, backgroundColor: theme.bg, borderRadius: 8, padding: 8, minHeight: 44 },
  noteText: { color: theme.text, fontSize: 13, lineHeight: 18 },
  noteEmpty: { color: theme.muted, fontSize: 13 },
  noteWhen: { color: theme.muted, fontSize: 11, marginTop: 4 },
  frame: { width: '100%', backgroundColor: theme.input, borderRadius: 12, minHeight: 120, overflow: 'hidden' },
  shot: { width: '100%', height: 140 },
  extraRow: { flexDirection: 'row', gap: 4, padding: 4 },
  extra: { width: 42, height: 42, borderRadius: 6 },
  empty: { color: theme.muted, textAlign: 'center', padding: 24 },
  enlarge: { position: 'absolute', right: 6, bottom: 6, color: theme.white, backgroundColor: 'rgba(0,0,0,0.45)', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11 },
  state: { color: theme.green, fontWeight: '700', marginTop: 6 },
  notes: { color: theme.text, marginTop: 8, lineHeight: 20 },
  stampLine: { color: theme.muted, marginTop: 4, fontSize: 13 },
  photoStamp: { color: theme.muted, fontSize: 10, paddingHorizontal: 6, paddingBottom: 4 },
  extraStamp: { color: theme.muted, fontSize: 8, width: 42 },
  noteLine: { color: theme.text, marginTop: 6, fontSize: 13, lineHeight: 18 },
  delete: { marginTop: 22, backgroundColor: theme.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteText: { color: theme.white, fontWeight: '800' },
  deleteError: { color: theme.danger, marginTop: 8, fontWeight: '600' },
  cancel: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '700' },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
});
