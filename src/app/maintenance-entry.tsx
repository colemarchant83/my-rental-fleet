import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { clocksDisagree, formatDay, formatStamp, keepPhoto, loadCachedVehicles, todayIso, type CachedVehicle, type PhotoRef } from '../fleet-store';
import { deleteMaintenance, loadMaintenanceRecord, saveMaintenance } from '../maintenance-store';
import { buildMaintenanceCard, deliverRentalFile } from '../save-card';
import { maintenanceReadyToShare, publishMaintenanceShare } from '../share-link';
import { deleteStoredFile, useDisplayUri } from '../media';
import { deleteStoredObject } from '../r2';
import { ZoomModal } from '../components/zoom-modal';
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
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [notesAt, setNotesAt] = useState('');
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [savedAt, setSavedAt] = useState('');
  const [serverSavedAt, setServerSavedAt] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [fileNote, setFileNote] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkNote, setLinkNote] = useState('');
  const builtFile = useRef<File | null>(null);

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
      setCost(record.cost || '');
      setNotes(record.notes);
      setNotesAt(record.notesAt || '');
      setPhotos(record.photos ?? []);
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
    void saveMaintenance({ localId, vehicleId, date: date || todayIso(), work, notes, miles, hours, cost, photos })
      .then(() => router.back())
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not save this record.'))
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

  const addPhotos = async (camera: boolean) => {
    const room = 8 - photos.length;
    if (room <= 0) return;
    const options = {
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.92,
      allowsMultipleSelection: !camera,
      selectionLimit: room,
    };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setError('');
    try {
      const saved: PhotoRef[] = [];
      for (const asset of result.assets.slice(0, room)) {
        saved.push(await keepPhoto(asset.uri));
        if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri);
      }
      setPhotos((current) => [...current, ...saved].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This photo could not be saved.');
    }
  };

  const removePhoto = (photo: PhotoRef) => {
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    void deleteStoredFile(photo.localUri);
    void deleteStoredObject(photo.remoteUrl).catch(() => undefined);
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
              <Text style={styles.factLabel}>Cost</Text>
              <Text style={styles.factValue}>{cost.trim() ? (cost.trim().startsWith('$') ? cost.trim() : `$${cost.trim()}`) : '—'}</Text>
            </View>
            <View style={[styles.noteBox, styles.photoBox]}>
              <Text style={styles.factLabel}>Notes</Text>
              <Text style={styles.noteBody}>{notes.trim() || 'No notes'}</Text>
            </View>
            {photos.length ? (
              <View style={[styles.noteBox, styles.photoBox]}>
                <Text style={styles.factLabel}>Receipts and invoices</Text>
                <View style={styles.photoRow}>
                  {photos.map((photo) => (
                    <ReceiptPhoto key={photo.id} photo={photo} onOpen={setZoom} />
                  ))}
                </View>
              </View>
            ) : null}
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
          <Text style={styles.label}>Cost</Text>
          <TextInput style={styles.input} value={cost} onChangeText={setCost} placeholder="0.00" placeholderTextColor={theme.muted} keyboardType="decimal-pad" />
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notes]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Detailed description of work performed"
            placeholderTextColor={theme.muted}
            multiline
          />
          <Text style={styles.label}>Receipts and invoices</Text>
          <Text style={styles.help}>Photos only. Take a picture or add one from your library. Up to 8.</Text>
          {photos.length ? (
            <View style={styles.photoRow}>
              {photos.map((photo) => (
                <ReceiptPhoto key={photo.id} photo={photo} onOpen={setZoom} onRemove={() => removePhoto(photo)} />
              ))}
            </View>
          ) : null}
          {photos.length < 8 ? (
            <View style={styles.photoActions}>
              <Pressable style={styles.photoButton} onPress={() => void addPhotos(true)}>
                <Text style={styles.photoButtonText}>Take photo</Text>
              </Pressable>
              <Pressable style={styles.photoButton} onPress={() => setLibraryOpen(true)}>
                <Text style={styles.photoButtonText}>Photo library</Text>
              </Pressable>
            </View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.save} disabled={saving} onPress={save}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save record'}</Text>
          </Pressable>
        </>
      )}
      {saved ? (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.fileSave, fileSaving && styles.saveWaiting]}
            disabled={fileSaving}
            onPress={() => {
              const openSave = (file: File) => {
                void deliverRentalFile(file).then((method) => {
                  if (method === 'cancelled') return;
                  if (method === 'blocked') {
                    setFileReady(true);
                    setFileNote('');
                    return;
                  }
                  setFileReady(false);
                  setFileNote('');
                });
              };
              if (builtFile.current) {
                openSave(builtFile.current);
                return;
              }
              setFileSaving(true);
              setFileReady(false);
              setFileNote('');
              void buildMaintenanceCard(
                { work, date, notes, notesAt, miles, hours, cost, savedAt, serverSavedAt, photos },
                vehicle ? { nickname: vehicle.nickname, yearMakeModel: vehicle.yearMakeModel, vin: vehicle.vin } : undefined,
              )
                .then(({ file, missing }) => {
                  builtFile.current = file;
                  setFileNote(missing.length ? 'Some photos could not be included because they are not on this phone right now.' : '');
                  openSave(file);
                })
                .catch((err: unknown) => setFileNote(err instanceof Error ? err.message : 'Could not save this card.'))
                .finally(() => setFileSaving(false));
            }}
          >
            <Text style={styles.fileSaveText}>{fileSaving ? 'Preparing photos...' : fileReady ? 'Ready. Tap to save' : 'Save to files'}</Text>
          </Pressable>
          {fileNote ? <Text style={styles.help}>{fileNote}</Text> : null}
          <Pressable
            style={[styles.fileLink, linking && styles.saveWaiting]}
            disabled={linking}
            onPress={() => {
              if (!maintenanceReadyToShare(photos)) {
                setLinkNote('Wait until the photos finish uploading. Then this link can include them.');
                return;
              }
              setLinking(true);
              setLinkNote('');
              void publishMaintenanceShare(
                { work, date, notes, notesAt, miles, hours, cost, savedAt, serverSavedAt, photos },
                vehicle ? { nickname: vehicle.nickname, yearMakeModel: vehicle.yearMakeModel, vin: vehicle.vin } : undefined,
              )
                .then(async (url) => {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    await navigator.share({
                      title: `${work.trim() || 'Maintenance'} record`,
                      text: 'Open this link to view the maintenance record and save the photos.',
                      url,
                    });
                    return;
                  }
                  setLinkNote(url);
                })
                .catch((err: unknown) => {
                  if (err instanceof Error && err.name === 'AbortError') return;
                  setLinkNote(err instanceof Error ? err.message : 'Could not make the link.');
                })
                .finally(() => setLinking(false));
            }}
          >
            <Text style={styles.fileLinkText}>{linking ? 'Making the link...' : 'Text or email this card'}</Text>
          </Pressable>
          {linkNote ? <Text style={styles.help}>{linkNote}</Text> : null}
          <Pressable style={styles.delete} onPress={() => setConfirming(true)}>
            <Text style={styles.deleteText}>Delete this record</Text>
          </Pressable>
          <Modal visible={confirming} transparent animationType="fade" onRequestClose={() => setConfirming(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.spotTitle}>Delete this record?</Text>
                <Text style={styles.help}>
                  This permanently deletes the {work.trim() || 'maintenance'} record from {formatDay(date)}, including the notes and every receipt photo stored for this record. Nothing from this record is kept. This cannot be undone.
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
      <Modal visible={libraryOpen} transparent animationType="fade" onRequestClose={() => setLibraryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.spotTitle}>Photo library</Text>
            <Text style={styles.help}>
              A photo from your library or files is stamped when you add it to this record, not when the camera first took it. Take Photo if you want the time the picture was made.
            </Text>
            <Pressable
              style={styles.save}
              onPress={() => {
                setLibraryOpen(false);
                void addPhotos(false);
              }}
            >
              <Text style={styles.saveText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setLibraryOpen(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ZoomModal uri={zoom} onClose={() => setZoom(null)} />
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
  photoBox: { marginTop: 12 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoButton: { flex: 1, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.line, paddingVertical: 14, alignItems: 'center' },
  photoButtonText: { color: theme.text, fontWeight: '800' },
  receipt: { width: 104 },
  receiptImage: { width: 104, height: 104, borderRadius: 10, backgroundColor: theme.input },
  photoStamp: { color: theme.muted, fontSize: 11, marginTop: 4 },
  removeText: { color: theme.danger, fontWeight: '700', marginTop: 4 },
  noteBody: { color: theme.text, marginTop: 6, fontSize: 16, lineHeight: 22 },
  label: { color: theme.muted, fontWeight: '700', marginTop: 16 },
  input: { backgroundColor: theme.input, borderRadius: 12, padding: 14, marginTop: 8, color: theme.text },
  notes: { minHeight: 110, textAlignVertical: 'top' },
  stamp: { color: theme.muted, marginTop: 12 },
  error: { color: theme.danger, marginTop: 12 },
  save: { backgroundColor: theme.action, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  saveText: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  fileSave: { marginTop: 22, backgroundColor: theme.text, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  fileSaveText: { color: theme.white, fontWeight: '800' },
  fileLink: { marginTop: 10, marginBottom: 28, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.line, paddingVertical: 14, alignItems: 'center' },
  fileLinkText: { color: theme.text, fontWeight: '800' },
  saveWaiting: { opacity: 0.55 },
  delete: { marginTop: 22, backgroundColor: theme.danger, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  deleteText: { color: theme.white, fontWeight: '800' },
  cancel: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '700' },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  spotTitle: { fontWeight: '800', color: theme.text, marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
});

function ReceiptPhoto({ photo, onOpen, onRemove }: { photo: PhotoRef; onOpen: (uri: string) => void; onRemove?: () => void }) {
  const display = useDisplayUri(photo.localUri, photo.remoteUrl);
  return (
    <View style={styles.receipt}>
      <Pressable onPress={() => display.uri && onOpen(display.uri)}>
        {display.uri ? <Image source={{ uri: display.uri }} style={styles.receiptImage} onError={display.failRemote} /> : <View style={styles.receiptImage} />}
      </Pressable>
      {photo.addedAt ? <Text style={styles.photoStamp}>{formatStamp(photo.addedAt)}</Text> : null}
      {photo.serverAddedAt ? <Text style={styles.photoStamp}>Server {formatStamp(photo.serverAddedAt)}</Text> : null}
      {onRemove ? (
        <Pressable onPress={onRemove}>
          <Text style={styles.removeText}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
