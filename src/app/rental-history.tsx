import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ZoomModal } from '../components/zoom-modal';
import { VideoPreview } from '../components/inspection-form';
import { useDisplayUri } from '../media';
import { SPOTS, clocksDisagree, deleteRental, fetchRentalByLocalId, formatDay, formatStamp, loadCachedVehicles, loadRentals, rentalByLocalId, subscribeFleet, type InspectionSide, type LocalRental } from '../fleet-store';
import { buildRentalCard, deliverRentalFile } from '../save-card';
import { cardReadyToShare, publishShareLink } from '../share-link';
import { theme } from '../theme';

type RemotePhoto = string | { url?: string; addedAt?: string; serverAddedAt?: string; sha256?: string };
type RemoteSpot = { status?: string; note?: string; notedAt?: string; photos?: RemotePhoto[] };

export default function RentalHistory() {
  const params = useLocalSearchParams<{ localId?: string | string[]; id?: string | string[] }>();
  const localId = Array.isArray(params.localId) ? params.localId[0] : params.localId;
  const remoteId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [rental, setRental] = useState<LocalRental | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveReady, setSaveReady] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkNote, setLinkNote] = useState('');
  const missingNote = useRef('');
  const builtFile = useRef<File | null>(null);
  const openedVehicle = useRef('');

  useEffect(() => {
    const refresh = async () => {
      if (localId) {
        const found = await rentalByLocalId(localId);
        if (!found) {
          const remote = await fetchRentalByLocalId(localId).catch(() => undefined);
          if (remote) {
            openedVehicle.current = remote.vehicleId;
            setRental(remote);
            return;
          }
          if (openedVehicle.current) router.replace({ pathname: '/vehicle', params: { id: openedVehicle.current } });
          else setRental(null);
          return;
        }
        openedVehicle.current = found.vehicleId;
        setRental(found);
        return;
      }
      if (!remoteId) return;
      const local = (await loadRentals()).find((item) => item.remoteId === remoteId);
      if (local) {
        setRental(local);
        return;
      }
      const snap = await getDoc(doc(db, 'rentals', remoteId));
      if (!snap.exists()) return;
      setRental(fromRemote(remoteId, snap.data() as Record<string, unknown>));
    };
    void refresh();
    return subscribeFleet(() => void refresh());
  }, [localId, remoteId, router]);

  if (!rental) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingTitle}>Loading rental files...</Text>
        <Text style={styles.muted}>This rental is opening.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.renter}>{rental.renterName || 'Renter'}</Text>
        <View style={styles.pill}><Text style={styles.pillText}>{rental.status === 'closed' ? 'Returned' : 'Out'}</Text></View>
      </View>
      <Text style={styles.muted}>
        Out {formatDay(rental.checkout?.date)}
        {rental.checkin ? ` · Back ${formatDay(rental.checkin.date)}` : ''}
      </Text>
      {rental.checkout.savedAt ? <Text style={styles.stampLine}>Checkout recorded on this phone {formatStamp(rental.checkout.savedAt)}</Text> : null}
      {rental.checkout.serverSavedAt ? <Text style={styles.stampLine}>Server time {formatStamp(rental.checkout.serverSavedAt)}</Text> : null}
      {clocksDisagree(rental.checkout.savedAt, rental.checkout.serverSavedAt) ? <Text style={styles.mismatch}>Phone time does not match the server.</Text> : null}
      {rental.checkin?.savedAt ? <Text style={styles.stampLine}>Return recorded on this phone {formatStamp(rental.checkin.savedAt)}</Text> : null}
      {rental.checkin?.serverSavedAt ? <Text style={styles.stampLine}>Server time {formatStamp(rental.checkin.serverSavedAt)}</Text> : null}
      {rental.checkin && clocksDisagree(rental.checkin.savedAt, rental.checkin.serverSavedAt) ? <Text style={styles.mismatch}>Phone time does not match the server.</Text> : null}
      {rental.serverReceivedAt ? <Text style={styles.stampLine}>Server received this record {formatStamp(new Date(rental.serverReceivedAt).toISOString())}</Text> : null}
      {rental.sync !== 'synced' ? (
        <Text style={styles.waiting}>
          {rental.syncError && !/expo-file-system|native dependencies|Could not read the saved photo/i.test(rental.syncError)
            ? rental.syncError
            : 'Files are saved on this phone, so nothing will be lost. This notice goes away when the photos and video are uploaded to storage. If this was done offline, the upload happens when the internet connection is back.'}
        </Text>
      ) : rental.syncError ? <Text style={styles.waiting}>{rental.syncError}</Text> : null}
      {rental.status === 'out' ? (
        <Pressable
          style={styles.checkin}
          onPress={() => router.push({ pathname: '/inspection', params: { vehicleId: rental.vehicleId, type: 'checkin' } })}
        >
          <Text style={styles.checkinText}>Start return inspection</Text>
        </Pressable>
      ) : null}

      {rental.checkout.videoUri || rental.checkout.videoUrl ? (
        <View>
          <Text style={styles.videoTitle}>Check out</Text>
          <Text style={styles.stampLine}>{formatStamp(rental.checkout.videoAddedAt)}{rental.checkout.videoSha256 ? ` · File ${rental.checkout.videoSha256.slice(0, 8)}` : ''}</Text>
          {rental.checkout.videoServerAddedAt || rental.serverReceivedAt ? <Text style={styles.stampLine}>Server received this video {formatStamp(rental.checkout.videoServerAddedAt || receivedIso(rental.serverReceivedAt) || '')}</Text> : null}
          <VideoPreview uri={rental.checkout.videoUri || rental.checkout.videoUrl} />
        </View>
      ) : null}
      {rental.checkin?.videoUri || rental.checkin?.videoUrl ? (
        <View>
          <Text style={styles.videoTitle}>Check in</Text>
          <Text style={styles.stampLine}>{formatStamp(rental.checkin.videoAddedAt)}{rental.checkin.videoSha256 ? ` · File ${rental.checkin.videoSha256.slice(0, 8)}` : ''}</Text>
          {rental.checkin.videoServerAddedAt || rental.serverReceivedAt ? <Text style={styles.stampLine}>Server received this video {formatStamp(rental.checkin.videoServerAddedAt || receivedIso(rental.serverReceivedAt) || '')}</Text> : null}
          <VideoPreview uri={rental.checkin.videoUri || rental.checkin.videoUrl} />
        </View>
      ) : null}

      <View style={styles.readings}>
        <View style={styles.compare}>
          <Text style={[styles.sideLabel, styles.sideCol]}>Check out</Text>
          <Text style={[styles.sideLabel, styles.sideCol]}>Check in</Text>
        </View>
        <Reading outLabel="Fuel out" inLabel="Fuel in" out={rental.checkout.fuel} back={rental.checkin?.fuel} returned={!!rental.checkin} />
        <Reading outLabel="Miles out" inLabel="Miles in" out={rental.checkout.miles} back={rental.checkin?.miles} returned={!!rental.checkin} />
        <Reading outLabel="Hours out" inLabel="Hours in" out={rental.checkout.hours} back={rental.checkin?.hours} returned={!!rental.checkin} />
      </View>

      {SPOTS.map((spot) => {
        const blank = { status: '' as const, note: '', photos: [] };
        const out = rental.checkout.spots[spot.id] ?? blank;
        const back = rental.checkin?.spots[spot.id];
        return (
          <View key={spot.id} style={styles.spot}>
            <Text style={styles.spotTitle}>{spot.label}</Text>
            <View style={styles.compare}>
              <View style={styles.sideCol}>
                <Text style={styles.sideLabel}>Check out</Text>
                <PhotoStack photos={photosOf(rental.checkout, spot.id, receivedIso(rental.serverReceivedAt))} empty="No photo" onOpen={setZoom} />
                <View style={styles.noteBox}>
                  <Text style={out.note.trim() ? styles.noteText : styles.noteEmpty}>{out.note.trim() || 'No note'}</Text>
                  {out.note.trim() && out.notedAt ? <Text style={styles.noteWhen}>{formatStamp(out.notedAt)}</Text> : null}
                </View>
                <Text style={[styles.state, out.status === 'issue' ? styles.issue : out.status === 'ok' ? styles.ok : null]}>{labelStatus(out.status)}</Text>
              </View>
              <View style={styles.sideCol}>
                <Text style={styles.sideLabel}>Check in</Text>
                <PhotoStack photos={rental.checkin ? photosOf(rental.checkin, spot.id, receivedIso(rental.serverReceivedAt)) : []} empty={rental.checkin ? 'No photo' : 'Not returned yet'} onOpen={setZoom} />
                <View style={styles.noteBox}>
                  <Text style={back?.note.trim() ? styles.noteText : styles.noteEmpty}>{back?.note.trim() || 'No note'}</Text>
                  {back?.note.trim() && back.notedAt ? <Text style={styles.noteWhen}>{formatStamp(back.notedAt)}</Text> : null}
                </View>
                <Text style={[styles.state, back?.status === 'issue' ? styles.issue : back?.status === 'ok' ? styles.ok : null]}>{rental.checkin ? labelStatus(back?.status || '') : '—'}</Text>
              </View>
            </View>
          </View>
        );
      })}

      {rental.checkout.notes ? <Text style={styles.notes}>Checkout notes · {formatStamp(rental.checkout.notesAt)}{'\n'}{rental.checkout.notes}</Text> : null}
      {rental.checkin?.notes ? <Text style={styles.notes}>Return notes · {formatStamp(rental.checkin.notesAt)}{'\n'}{rental.checkin.notes}</Text> : null}
      <Pressable
        style={[styles.save, saving && styles.saveWaiting]}
        disabled={saving}
        onPress={() => {
          const openSave = (file: File) => {
            void deliverRentalFile(file).then((method) => {
              if (method === 'cancelled') return;
              if (method === 'blocked') {
                setSaveReady(true);
                setSaveNote('');
                return;
              }
              setSaveReady(false);
              setSaveNote(missingNote.current.trim());
            });
          };
          if (builtFile.current) {
            openSave(builtFile.current);
            return;
          }
          setSaving(true);
          setSaveReady(false);
          setSaveNote('');
          void buildRentalCard(rental)
            .then(({ file, missing }) => {
              builtFile.current = file;
              missingNote.current = missing.length ? ' Some files could not be included because they are not on this phone right now.' : '';
              openSave(file);
            })
            .catch((error: unknown) => {
              setSaveNote(error instanceof Error ? error.message : 'Could not save this card.');
            })
            .finally(() => setSaving(false));
        }}
      >
        <Text style={styles.saveText}>{saving ? 'Preparing photos and video...' : saveReady ? 'Ready. Tap to save or share' : 'Save to files or share this card'}</Text>
      </Pressable>
      {saveNote ? <Text style={styles.help}>{saveNote}</Text> : null}
      <Pressable
        style={[styles.link, linking && styles.saveWaiting]}
        disabled={linking}
        onPress={() => {
          if (!rental) return;
          if (!cardReadyToShare(rental)) {
            setLinkNote('Wait until the photos and video finish uploading. Then this link can include them.');
            return;
          }
          setLinking(true);
          setLinkNote('');
          void loadCachedVehicles()
            .then((vehicles) => {
              const machine = vehicles.find((item) => item.id === rental.vehicleId);
              return publishShareLink(rental, machine);
            })
            .then(async (url) => {
              if (typeof navigator !== 'undefined' && navigator.share) {
                await navigator.share({
                  title: `${rental.renterName || 'Rental'} card`,
                  text: 'Open this link to view the rental card and save the photos and video.',
                  url,
                });
                return;
              }
              setLinkNote(url);
            })
            .catch((error: unknown) => {
              if (error instanceof Error && error.name === 'AbortError') return;
              setLinkNote(error instanceof Error ? error.message : 'Could not make the link.');
            })
            .finally(() => setLinking(false));
        }}
      >
        <Text style={styles.linkText}>{linking ? 'Making the link...' : 'Text or email this card'}</Text>
      </Pressable>
      {linkNote ? <Text style={styles.help}>{linkNote}</Text> : null}
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
                  .then(() => router.replace({ pathname: '/vehicle', params: { id: rental.vehicleId } }))
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

type StampedPhoto = { localUri?: string; remoteUrl?: string; addedAt?: string; serverAddedAt?: string };

function receivedIso(value?: number | string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function photosOf(side: InspectionSide, spotId: (typeof SPOTS)[number]['id'], receivedAt?: string): StampedPhoto[] {
  return (side.spots[spotId]?.photos ?? [])
    .map((photo) => ({
      localUri: photo.localUri,
      remoteUrl: photo.remoteUrl,
      addedAt: photo.addedAt,
      serverAddedAt: photo.serverAddedAt || (photo.remoteUrl ? receivedAt : undefined),
    }))
    .filter((photo) => photo.localUri || photo.remoteUrl);
}

function labelStatus(status: string) {
  if (status === 'issue') return 'Issue';
  if (status === 'ok') return 'OK';
  return '—';
}

function HistoryPhoto({ photo, style, onOpen, empty, compact }: { photo: StampedPhoto; style: object; onOpen: (uri: string) => void; empty: string; compact?: boolean }) {
  const display = useDisplayUri(photo.localUri, photo.remoteUrl);
  if (!display.uri) {
    if (!empty) return null;
    return <View style={styles.frame}><Text style={styles.empty}>{empty}</Text></View>;
  }
  return (
    <View style={compact ? styles.extraWrap : undefined}>
      <Pressable onPress={() => onOpen(display.uri)}>
        <Image source={{ uri: display.uri }} style={style} resizeMode="cover" onError={display.failRemote} />
        {compact ? null : <Text pointerEvents="none" style={styles.enlarge}>Enlarge</Text>}
      </Pressable>
      {!compact && photo.addedAt ? <Text style={styles.photoStamp}>{formatStamp(photo.addedAt)}</Text> : null}
      {!compact && photo.serverAddedAt ? <Text style={styles.photoStamp}>Server {formatStamp(photo.serverAddedAt)}</Text> : null}
    </View>
  );
}

function PhotoStack({ photos, empty, onOpen }: { photos: StampedPhoto[]; empty: string; onOpen: (uri: string) => void }) {
  if (!photos.length) {
    return <View style={styles.frame}><Text style={styles.empty}>{empty}</Text></View>;
  }
  const extras = photos.slice(1, 4);
  return (
    <View style={styles.stack}>
      <HistoryPhoto photo={photos[0]} style={styles.shot} onOpen={onOpen} empty={empty} />
      {extras.length ? (
        <View style={styles.extraRow}>
          {extras.map((photo, index) => (
            <HistoryPhoto key={`${photo.localUri ?? ''}-${photo.remoteUrl ?? ''}-${index}`} photo={photo} style={styles.extra} onOpen={onOpen} empty="" compact />
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

function Reading({ outLabel, inLabel, out, back, returned }: { outLabel: string; inLabel: string; out?: string; back?: string; returned: boolean }) {
  const shown = (value?: string) => (value && value.trim()) || '—';
  return (
    <View style={[styles.compare, styles.reading]}>
      <View style={styles.sideCol}>
        <Text style={styles.statLabel}>{outLabel}</Text>
        <Text style={styles.readingValue}>{shown(out)}</Text>
      </View>
      <View style={styles.sideCol}>
        <Text style={styles.statLabel}>{inLabel}</Text>
        <Text style={styles.readingValue}>{returned ? shown(back) : '—'}</Text>
      </View>
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
    serverReceivedAt: typeof data.serverReceivedAt === 'object' && data.serverReceivedAt && 'seconds' in data.serverReceivedAt ? Number((data.serverReceivedAt as { seconds: number }).seconds) * 1000 : undefined,
    checkout: sideFrom(checkout, String(data.checkoutDate || '')),
    checkin: checkinRaw ? sideFrom(checkinRaw, String(data.checkinDate || '')) : undefined,
  };
}

function sideFrom(raw: { date?: string; fuel?: string; miles?: string; hours?: string; notes?: string; notesAt?: string; savedAt?: string; serverSavedAt?: string; videoAddedAt?: string; videoServerAddedAt?: string; videoSha256?: string; videoUrl?: string; spots?: Record<string, RemoteSpot> }, fallbackDate: string): InspectionSide {
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
        const serverAddedAt = typeof photo === 'string' ? undefined : photo.serverAddedAt;
        const sha256 = typeof photo === 'string' ? undefined : photo.sha256;
        return { id: `${spot.id}-${index}`, localUri: url, remoteUrl: url, addedAt, serverAddedAt, sha256 };
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
    serverSavedAt: raw.serverSavedAt,
    videoUrl: raw.videoUrl,
    videoAddedAt: raw.videoAddedAt,
    videoServerAddedAt: raw.videoServerAddedAt,
    videoSha256: raw.videoSha256,
    spots,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  loading: { flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' },
  loadingTitle: { color: theme.text, fontSize: 22, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  renter: { fontSize: 28, fontWeight: '800', color: theme.text, flex: 1 },
  pill: { backgroundColor: theme.input, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontWeight: '700', color: theme.text },
  muted: { color: theme.muted, marginTop: 6 },
  waiting: { color: theme.rent, marginTop: 8 },
  checkin: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 14 },
  checkinText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  readings: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 12, marginTop: 14, marginBottom: 12 },
  reading: { marginTop: 8 },
  readingValue: { color: theme.text, fontWeight: '700', fontSize: 16, marginTop: 2 },
  statLabel: { color: theme.muted, fontSize: 12 },
  statValue: { color: theme.text, fontWeight: '700', marginTop: 2 },
  section: { fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 20, marginBottom: 8 },
  spot: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 12, marginBottom: 12 },
  spotTitle: { fontWeight: '800', color: theme.text, marginBottom: 8 },
  compare: { flexDirection: 'row', gap: 8 },
  sideCol: { flex: 1, minWidth: 0 },
  sideLabel: { color: theme.text, fontWeight: '800', fontSize: 13, marginBottom: 6 },
  noteBox: { marginTop: 6, backgroundColor: theme.bg, borderRadius: 8, padding: 8, minHeight: 44 },
  noteText: { color: theme.text, fontSize: 13, lineHeight: 18 },
  noteEmpty: { color: theme.muted, fontSize: 13 },
  noteWhen: { color: theme.muted, fontSize: 11, marginTop: 4 },
  frame: { width: '100%', backgroundColor: theme.input, borderRadius: 12, minHeight: 120, overflow: 'hidden' },
  shot: { width: '100%', height: 140 },
  stack: { width: '100%' },
  extraRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  extraWrap: { width: 48, height: 48, borderRadius: 6, overflow: 'hidden' },
  extra: { width: 48, height: 48, borderRadius: 6 },
  empty: { color: theme.muted, textAlign: 'center', padding: 24 },
  enlarge: { position: 'absolute', right: 6, bottom: 6, color: theme.white, backgroundColor: 'rgba(0,0,0,0.45)', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11 },
  state: { color: theme.muted, fontWeight: '700', marginTop: 6 },
  ok: { color: theme.green },
  issue: { color: '#c47d00' },
  notes: { color: theme.text, marginTop: 8, lineHeight: 20 },
  save: { marginTop: 22, marginBottom: 10, backgroundColor: theme.text, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveWaiting: { opacity: 0.55 },
  saveText: { color: theme.white, fontWeight: '800' },
  stampLine: { color: theme.muted, marginTop: 4, fontSize: 13 },
  videoTitle: { color: theme.text, fontSize: 22, fontWeight: '800', marginTop: 18 },
  mismatch: { color: theme.danger, marginTop: 4, fontSize: 13, fontWeight: '700' },
  photoStamp: { color: theme.muted, fontSize: 10, paddingHorizontal: 6, paddingBottom: 4 },
  extraStamp: { color: theme.muted, fontSize: 8, width: 42 },
  noteLine: { color: theme.text, marginTop: 6, fontSize: 13, lineHeight: 18 },
  link: { marginTop: 10, marginBottom: 36, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.line, paddingVertical: 14, alignItems: 'center' },
  linkText: { color: theme.text, fontWeight: '800' },
  delete: { marginTop: 22, backgroundColor: theme.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteText: { color: theme.white, fontWeight: '800' },
  deleteError: { color: theme.danger, marginTop: 8, fontWeight: '600' },
  cancel: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '700' },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
});
