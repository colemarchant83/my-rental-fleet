import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeButton, RefreshButton } from '../../components/back-link';
import { BrandMenu } from '../../components/brand-menu';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { currentOwnerId } from '../../account';
import { deleteVehicleRecord, loadCachedVehicles, loadCovers, rememberCover, saveCachedVehicles, vehicleIdLine, type CachedVehicle, type CoverPhoto } from '../../fleet-store';
import { deleteMaintenance, loadMaintenance } from '../../maintenance-store';
import { OfflineGate } from '../../components/offline-gate';
import { useDisplayUri } from '../../media';
import { WebVinScanner, extractVin } from '../../components/vin-scanner';
import { theme } from '../../theme';
import { loadPlanLimit } from '../../plan';

function PageBar({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.pageBar}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10} style={styles.pageSlot}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      ) : (
        <View style={styles.pageSlot} />
      )}
      <HomeButton />
      <View style={[styles.pageSlot, styles.pageSlotEnd]}>
        <RefreshButton />
      </View>
    </View>
  );
}

type Step = 'menu' | 'add' | 'delete' | 'barcode' | 'vin' | 'hull' | 'manual' | 'review';

async function decodeVin(vin: string) {
  const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
  if (!response.ok) return { yearMakeModel: '', specs: '' };
  const data = (await response.json()) as { Results?: Record<string, string>[] };
  const row = data.Results?.[0] || {};
  const value = (key: string) => String(row[key] || '').trim();
  const yearMakeModel = [value('ModelYear'), value('Make'), value('Model')].filter(Boolean).join(' ');
  const liters = Number(value('DisplacementL'));
  const engine = [
    liters ? `${Math.round(liters * 10) / 10}L` : '',
    value('EngineCylinders') ? `${value('EngineCylinders')}-cyl` : '',
    value('FuelTypePrimary'),
  ].filter(Boolean).join(' · ');
  return { yearMakeModel, specs: engine };
}

export default function AddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('menu');
  const [vehicles, setVehicles] = useState<CachedVehicle[]>([]);
  const [covers, setCovers] = useState<CoverPhoto[]>([]);
  const [nickname, setNickname] = useState('');
  const [yearMakeModel, setYearMakeModel] = useState('');
  const [specs, setSpecs] = useState('');
  const [vin, setVin] = useState('');
  const [photoUri, setPhotoUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [warnId, setWarnId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const locked = useRef(false);

  const loadVehicles = useCallback(() => {
    const uid = currentOwnerId();
    void loadCachedVehicles().then((saved) => setVehicles(saved.filter((item) => item.ownerId === uid)));
    void getDocs(query(collection(db, 'vehicles'), where('ownerId', '==', uid))).then((snap) => {
      const next = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as CachedVehicle);
      setVehicles(next);
      void saveCachedVehicles(next, true);
    }).catch(() => undefined);
    void loadCovers().then(setCovers);
  }, []);

  useFocusEffect(useCallback(() => {
    loadVehicles();
    return () => {
      setSaving(false);
      setReading(false);
      setStep('menu');
      setNickname('');
      setYearMakeModel('');
      setSpecs('');
      setVin('');
      setPhotoUri('');
      setError('');
    };
  }, [loadVehicles]));

  const resetForm = () => {
    setNickname('');
    setYearMakeModel('');
    setSpecs('');
    setVin('');
    setPhotoUri('');
    setError('');
  };

  const useVin = async (found: string) => {
    const next = extractVin(found) || found.trim().toUpperCase();
    if (!next) {
      setError('Enter a VIN.');
      return;
    }
    setVin(next);
    setError('');
    setReading(true);
    const decoded = await decodeVin(next).catch(() => ({ yearMakeModel: '', specs: '' }));
    setReading(false);
    if (decoded.yearMakeModel) setYearMakeModel(decoded.yearMakeModel);
    if (decoded.specs) setSpecs(decoded.specs);
    setStep('review');
  };

  const useHull = (found: string) => {
    const next = found.trim().toUpperCase();
    if (!next) {
      setError('Enter a hull number.');
      return;
    }
    setVin(next);
    setError('');
    setStep('review');
  };

  const saveVehicle = async () => {
    if (!nickname.trim() && !yearMakeModel.trim()) {
      setError('Enter a nickname or the year, make, and model.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const limit = await loadPlanLimit();
      if (limit && vehicles.length >= limit) {
        setError(`This plan covers ${limit} machines. Deactivating one does not open a spot. Delete an active machine or move to a larger plan before adding another.`);
        return;
      }
      const ref = await addDoc(collection(db, 'vehicles'), {
        nickname: nickname.trim(),
        yearMakeModel: yearMakeModel.trim(),
        specs: specs.trim(),
        vin: vin.trim().toUpperCase(),
        status: 'Available',
        ownerId: currentOwnerId(),
        createdAt: serverTimestamp(),
      });
      const vehicle = {
        id: ref.id,
        nickname: nickname.trim(),
        yearMakeModel: yearMakeModel.trim(),
        specs: specs.trim(),
        vin: vin.trim().toUpperCase(),
        status: 'Available',
        ownerId: currentOwnerId(),
      };
      const saved = await loadCachedVehicles();
      await saveCachedVehicles([vehicle, ...saved.filter((item) => item.id !== vehicle.id)]);
      if (photoUri) await rememberCover(ref.id, photoUri);
      resetForm();
      setStep('menu');
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const openCamera = async () => {
    setError('');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('The camera is needed to scan a VIN.');
        return;
      }
    }
    locked.current = false;
    setStep('barcode');
  };

  const pickPhoto = async (camera: boolean) => {
    setError('');
    const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.92 };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
  };

  const removeVehicle = async (vehicleId: string) => {
    setDeleting(true);
    setError('');
    try {
      const records = await loadMaintenance(vehicleId);
      for (const record of records) await deleteMaintenance(record.localId);
      await deleteVehicleRecord(vehicleId);
      setVehicles((current) => current.filter((item) => item.id !== vehicleId));
      setConfirmId('');
      setWarnId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this vehicle.');
    } finally {
      setDeleting(false);
    }
  };

  const warned = vehicles.find((item) => item.id === warnId);
  const confirming = vehicles.find((item) => item.id === confirmId);
  const goBack = () => {
    setError('');
    setStep(step === 'review' || step === 'vin' || step === 'hull' || step === 'manual' || step === 'barcode' ? 'add' : 'menu');
  };

  return (
    <OfflineGate>
      {step === 'barcode' ? (
        <View style={[styles.scanScreen, { paddingTop: insets.top + 8 }]}>
          <PageBar onBack={goBack} />
          <Text style={styles.heading}>VIN barcode</Text>
          <View style={styles.cameraFrame}>
            {Platform.OS === 'web' ? (
              <WebVinScanner
                onVin={(value) => {
                  const found = extractVin(value);
                  if (!found || locked.current) return;
                  locked.current = true;
                  void useVin(found);
                }}
              />
            ) : (
            <CameraView
              ref={camera}
              style={styles.cameraFill}
              facing="back"
              active
              barcodeScannerSettings={{ barcodeTypes: ['code39', 'code128', 'code93', 'qr', 'datamatrix', 'pdf417'] }}
              onBarcodeScanned={(result) => {
                const found = extractVin(result.data);
                if (!found || locked.current) return;
                locked.current = true;
                void useVin(found);
              }}
            />
            )}
            {Platform.OS === 'web' ? null : (
              <>
                <View pointerEvents="none" style={styles.wideBox} />
                <View pointerEvents="none" style={styles.tallBox} />
              </>
            )}
          </View>
          <Text style={styles.help}>{reading ? 'Looking up that VIN...' : 'Line the barcode up with either box and hold still.'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
      <View style={desktop ? styles.split : styles.screen}>
      {desktop ? (
        <View style={styles.splitList}>
          <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: desktop ? 8 : insets.top + 8 }]}>
            <Text style={styles.heading}>Machines</Text>
            {vehicles.length === 0 ? <Text style={styles.help}>No machines saved yet.</Text> : null}
            {vehicles.map((vehicle) => {
              const cover = covers.find((item) => item.vehicleId === vehicle.id);
              const picked = vehicle.id === warnId || vehicle.id === confirmId;
              return (
                <Pressable
                  key={vehicle.id}
                  style={[styles.machineCard, picked && styles.machineOn]}
                  onPress={() => {
                    if (step !== 'delete') return;
                    setError('');
                    setWarnId(vehicle.id);
                  }}
                >
                  <ListPhoto localUri={cover?.localUri} remoteUrl={cover?.remoteUrl || vehicle.photoUrl} />
                  <View style={styles.rowText}>
                    <Text style={styles.nick}>{vehicle.nickname || 'Untitled'}</Text>
                    {vehicle.yearMakeModel ? <Text style={styles.meta}>{vehicle.yearMakeModel}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <ScrollView style={desktop ? styles.splitDetail : styles.screen} contentContainerStyle={[styles.content, { paddingTop: desktop ? 8 : insets.top + 8 }]}>
        {step === 'menu' && !desktop ? (
          <View style={styles.menuBar}>
            <BrandMenu />
            <RefreshButton />
          </View>
        ) : step !== 'menu' ? (
          <PageBar onBack={goBack} />
        ) : null}

        {step === 'menu' ? (
          <>
            <Text style={styles.heading}>Add or delete a vehicle</Text>
            <Text style={styles.range}>Cars, trailers, side-by-sides, construction machines, boats, etc.</Text>
            <View style={desktop ? styles.boxRow : undefined}>
              <Pressable style={desktop ? styles.addBox : styles.choice} onPress={() => { resetForm(); setStep('add'); }}>
                <Text style={desktop ? styles.boxText : styles.choiceText}>Add vehicle</Text>
              </Pressable>
              <Pressable style={desktop ? styles.deleteBox : styles.deleteChoice} onPress={() => { setError(''); setStep('delete'); }}>
                <Text style={desktop ? styles.boxTextLight : styles.deleteChoiceText}>Delete vehicle</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {step === 'add' ? (
          <>
            <Text style={styles.heading}>Add vehicle</Text>
            {desktop ? null : <Pressable style={styles.choice} onPress={() => void openCamera()}><Text style={styles.choiceText}>Scan VIN barcode</Text></Pressable>}
            <Pressable style={styles.choice} onPress={() => { setError(''); setStep('vin'); }}><Text style={styles.choiceText}>Enter VIN</Text></Pressable>
            <Pressable style={styles.choice} onPress={() => { setError(''); setStep('hull'); }}><Text style={styles.choiceText}>Enter boat hull numbers</Text></Pressable>
            <Pressable style={styles.choice} onPress={() => { setError(''); setStep('manual'); }}><Text style={styles.choiceText}>Enter year, make, and model</Text></Pressable>
          </>
        ) : null}

        {step === 'vin' ? (
          <>
            <Text style={styles.heading}>Enter VIN</Text>
            <TextInput style={styles.input} placeholder="17 character VIN" placeholderTextColor={theme.muted} value={vin} onChangeText={setVin} autoCapitalize="characters" />
            <Pressable style={styles.choice} disabled={reading} onPress={() => void useVin(vin)}>
              {reading ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.choiceText}>Use this VIN</Text>}
            </Pressable>
          </>
        ) : null}

        {step === 'hull' ? (
          <>
            <Text style={styles.heading}>Enter boat hull numbers</Text>
            <TextInput style={styles.input} placeholder="Hull number" placeholderTextColor={theme.muted} value={vin} onChangeText={setVin} autoCapitalize="characters" />
            <Pressable style={styles.choice} onPress={() => useHull(vin)}>
              <Text style={styles.choiceText}>Use this hull number</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'manual' || step === 'review' ? (
          <>
            <Text style={styles.heading}>Add vehicle</Text>
            <Text style={styles.label}>Nickname</Text>
            <TextInput style={styles.input} placeholder="e.g. Dad's truck" placeholderTextColor={theme.muted} value={nickname} onChangeText={setNickname} />
            <Text style={styles.label}>Year, make, model</Text>
            <TextInput style={styles.input} placeholder="e.g. 2004 Dodge 3500" placeholderTextColor={theme.muted} value={yearMakeModel} onChangeText={setYearMakeModel} />
            <Text style={styles.label}>VIN or hull number, if it has one</Text>
            <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={theme.muted} value={vin} onChangeText={setVin} autoCapitalize="characters" />
            <Text style={styles.label}>Card photo</Text>
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" /> : <Text style={styles.help}>Optional. This is the photo on the machine card.</Text>}
            <View style={styles.photoRow}>
              <Pressable style={styles.photoButton} disabled={saving} onPress={() => void pickPhoto(true)}>
                <Text style={styles.photoButtonText}>{photoUri ? 'Retake photo' : 'Take photo'}</Text>
              </Pressable>
              <Pressable style={styles.photoButton} disabled={saving} onPress={() => void pickPhoto(false)}>
                <Text style={styles.photoButtonText}>{photoUri ? 'Change photo' : 'Photo library'}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.choice} disabled={saving} onPress={() => void saveVehicle()}>
              {saving ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.choiceText}>Save vehicle</Text>}
            </Pressable>
          </>
        ) : null}

        {step === 'delete' ? (
          desktop ? (
            <>
              <Text style={styles.heading}>Delete a vehicle</Text>
              <Text style={styles.deletePrompt}>Tap a vehicle/machine on the left to delete</Text>
            </>
          ) : (
          <>
            <Text style={styles.heading}>Delete a vehicle</Text>
            {vehicles.length === 0 ? <Text style={styles.help}>No machines saved yet.</Text> : null}
            {vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.machine}>{vehicle.nickname || vehicle.yearMakeModel || 'Untitled'}</Text>
                  {vehicle.yearMakeModel && vehicle.nickname ? <Text style={styles.meta}>{vehicle.yearMakeModel}</Text> : null}
                  {vehicle.vin ? <Text style={styles.meta}>{vehicleIdLine(vehicle.vin)}</Text> : null}
                </View>
                <Pressable style={styles.delete} onPress={() => { setError(''); setWarnId(vehicle.id); }}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            ))}
          </>
          )
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      </View>
      )}

      <Modal visible={!!warned && !confirming} transparent animationType="fade" onRequestClose={() => setWarnId('')}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, desktop && styles.modalCardDesktop]}>
            <Text style={styles.modalTitle}>Delete {warned?.nickname || warned?.yearMakeModel || 'this vehicle'}?</Text>
            <Text style={styles.help}>Deleting will erase all associated files, photos, and video. Any necessary files should be saved to files on the phone or computer before deleting.</Text>
            <Pressable style={styles.deleteWide} onPress={() => { setConfirmId(warnId); setWarnId(''); }}>
              <Text style={styles.deleteText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setWarnId('')}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirming} transparent animationType="fade" onRequestClose={() => { if (!deleting) setConfirmId(''); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, desktop && styles.modalCardDesktop]}>
            <Text style={styles.modalTitle}>Confirm delete</Text>
            <Text style={styles.help}>This permanently deletes {confirming?.nickname || confirming?.yearMakeModel || 'this vehicle'} and everything stored with it.</Text>
            <Pressable style={styles.deleteWide} disabled={deleting} onPress={() => confirming && void removeVehicle(confirming.id)}>
              <Text style={styles.deleteText}>{deleting ? 'Deleting...' : 'Confirm delete'}</Text>
            </Pressable>
            <Pressable style={styles.cancel} disabled={deleting} onPress={() => setConfirmId('')}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </OfflineGate>
  );
}

function ListPhoto({ localUri, remoteUrl }: { localUri?: string; remoteUrl?: string }) {
  const display = useDisplayUri(localUri, remoteUrl);
  if (!display.uri) return <View style={styles.thumb} />;
  return <Image source={{ uri: display.uri }} style={styles.thumb} resizeMode="contain" onError={display.failRemote} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  scanScreen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  content: { padding: 16, paddingBottom: 48 },
  heading: { fontSize: 32, fontWeight: '800', color: theme.text, marginBottom: 8 },
  range: { color: theme.muted, fontSize: 16, lineHeight: 22, marginBottom: 14 },
  back: { color: theme.accent, fontWeight: '800', fontSize: 16 },
  pageBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageSlot: { flex: 1 },
  pageSlotEnd: { alignItems: 'flex-end' },
  menuBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 8 },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  deletePrompt: { color: theme.text, marginTop: 12, fontSize: 22, fontWeight: '700', lineHeight: 30 },
  label: { color: theme.text, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: theme.input, color: theme.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  preview: { width: '100%', height: 260, borderRadius: 16, marginTop: 8, backgroundColor: theme.input },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoButton: { flex: 1, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.line, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  photoButtonText: { color: theme.text, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  choice: { backgroundColor: theme.action, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  choiceText: { color: theme.ink, fontWeight: '800', fontSize: 17 },
  deleteChoice: { backgroundColor: theme.danger, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  deleteChoiceText: { color: theme.white, fontWeight: '800', fontSize: 17 },
  boxRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  addBox: { flex: 1, minHeight: 160, borderRadius: 18, backgroundColor: theme.action, alignItems: 'center', justifyContent: 'center', padding: 16 },
  deleteBox: { flex: 1, minHeight: 160, borderRadius: 18, backgroundColor: theme.danger, alignItems: 'center', justifyContent: 'center', padding: 16 },
  boxText: { color: theme.ink, fontWeight: '800', fontSize: 22, textAlign: 'center' },
  boxTextLight: { color: theme.white, fontWeight: '800', fontSize: 22, textAlign: 'center' },
  split: { flex: 1, flexDirection: 'row', backgroundColor: theme.bg },
  splitList: { width: 440, maxWidth: '42%', borderRightWidth: 1, borderRightColor: theme.line },
  splitDetail: { flex: 1, minWidth: 0 },
  machineCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 10, marginBottom: 10 },
  machineOn: { borderColor: theme.accent, borderWidth: 2 },
  thumb: { width: 96, height: 72, borderRadius: 12, backgroundColor: theme.input },
  nick: { color: theme.accent, fontWeight: '800', fontSize: 16 },
  cameraFrame: { width: '100%', height: 420, borderRadius: 16, overflow: 'hidden', marginTop: 12, backgroundColor: '#111' },
  cameraFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  wideBox: { position: 'absolute', left: '8%', right: '8%', top: '38%', height: 84, borderWidth: 3, borderColor: theme.white, borderRadius: 12 },
  tallBox: { position: 'absolute', left: '36%', width: '28%', top: '12%', bottom: '12%', borderWidth: 3, borderColor: theme.white, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.line, padding: 14, marginTop: 12 },
  rowText: { flex: 1 },
  machine: { color: theme.text, fontWeight: '800', fontSize: 18 },
  meta: { color: theme.muted, marginTop: 2 },
  delete: { backgroundColor: theme.danger, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  deleteWide: { marginTop: 16, backgroundColor: theme.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { color: theme.white, fontWeight: '800' },
  error: { color: theme.danger, marginTop: 12 },
  cancel: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
  modalCardDesktop: { width: '50%', alignSelf: 'center' },
  modalTitle: { fontWeight: '800', color: theme.text, fontSize: 20 },
});
