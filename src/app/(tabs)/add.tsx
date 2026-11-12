import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { deleteVehicleRecord, loadCachedVehicles, saveCachedVehicles, type CachedVehicle } from '../../fleet-store';
import { deleteMaintenance, loadMaintenance } from '../../maintenance-store';
import { OfflineGate } from '../../components/offline-gate';
import { theme } from '../../theme';

type Step = 'menu' | 'add' | 'delete' | 'plate' | 'barcode' | 'vin' | 'manual' | 'review';

function extractVin(text: string) {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (let index = 0; index <= compact.length - 17; index += 1) {
    const slice = compact.slice(index, index + 17).replace(/[IOQ]/g, (char) => (char === 'I' ? '1' : '0'));
    if (/^[A-HJ-NPR-Z0-9]{17}$/.test(slice)) return slice;
  }
  return '';
}

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

async function readPlate(uri: string) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(uri);
    return extractVin(result.data.text);
  } finally {
    await worker.terminate();
  }
}

export default function AddScreen() {
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<Step>('menu');
  const [vehicles, setVehicles] = useState<CachedVehicle[]>([]);
  const [nickname, setNickname] = useState('');
  const [yearMakeModel, setYearMakeModel] = useState('');
  const [specs, setSpecs] = useState('');
  const [vin, setVin] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [warnId, setWarnId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [deleting, setDeleting] = useState(false);
  const locked = useRef(false);

  const loadVehicles = useCallback(() => {
    void loadCachedVehicles().then(setVehicles);
    void getDocs(collection(db, 'vehicles')).then((snap) => {
      const next = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as CachedVehicle);
      if (next.length) setVehicles(next);
    }).catch(() => undefined);
  }, []);

  useFocusEffect(loadVehicles);

  const resetForm = () => {
    setNickname('');
    setYearMakeModel('');
    setSpecs('');
    setVin('');
    setError('');
  };

  const useVin = async (found: string) => {
    const next = extractVin(found) || found.trim().toUpperCase();
    setVin(next);
    setError('');
    setReading(true);
    const decoded = await decodeVin(next).catch(() => ({ yearMakeModel: '', specs: '' }));
    setReading(false);
    if (decoded.yearMakeModel) setYearMakeModel(decoded.yearMakeModel);
    if (decoded.specs) setSpecs(decoded.specs);
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
      const ref = await addDoc(collection(db, 'vehicles'), {
        nickname: nickname.trim(),
        yearMakeModel: yearMakeModel.trim(),
        specs: specs.trim(),
        vin: vin.trim().toUpperCase(),
        status: 'Available',
        createdAt: serverTimestamp(),
      });
      const vehicle = {
        id: ref.id,
        nickname: nickname.trim(),
        yearMakeModel: yearMakeModel.trim(),
        specs: specs.trim(),
        vin: vin.trim().toUpperCase(),
        status: 'Available',
      };
      const saved = await loadCachedVehicles();
      await saveCachedVehicles([vehicle, ...saved.filter((item) => item.id !== vehicle.id)]);
      resetForm();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vehicle');
      setSaving(false);
    }
  };

  const openCamera = async (next: 'plate' | 'barcode') => {
    setError('');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('The camera is needed to scan a VIN.');
        return;
      }
    }
    locked.current = false;
    setStep(next);
  };

  const capturePlate = async () => {
    if (!camera.current || reading) return;
    setReading(true);
    setError('');
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.7 });
      const found = picture?.uri ? await readPlate(picture.uri) : '';
      if (!found) {
        setError('Could not read a VIN on that plate. Try again, or enter it manually.');
        setReading(false);
        return;
      }
      await useVin(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the VIN plate.');
      setReading(false);
    }
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

  return (
    <OfflineGate>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {step !== 'menu' ? (
          <Pressable onPress={() => { setError(''); setStep(step === 'review' || step === 'plate' || step === 'barcode' || step === 'vin' || step === 'manual' ? 'add' : 'menu'); }}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
        ) : null}

        {step === 'menu' ? (
          <>
            <Text style={styles.heading}>Add or delete a vehicle</Text>
            <Pressable style={styles.choice} onPress={() => { resetForm(); setStep('add'); }}>
              <Text style={styles.choiceText}>Add vehicle</Text>
            </Pressable>
            <Pressable style={styles.deleteChoice} onPress={() => { setError(''); setStep('delete'); }}>
              <Text style={styles.deleteChoiceText}>Delete vehicle</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'add' ? (
          <>
            <Text style={styles.heading}>Add vehicle</Text>
            <Text style={styles.help}>A VIN is optional. Some machines do not have one.</Text>
            <Pressable style={styles.choice} onPress={() => void openCamera('plate')}><Text style={styles.choiceText}>Scan VIN plate</Text></Pressable>
            <Pressable style={styles.choice} onPress={() => void openCamera('barcode')}><Text style={styles.choiceText}>Scan VIN barcode</Text></Pressable>
            <Pressable style={styles.choiceAlt} onPress={() => { setError(''); setStep('vin'); }}><Text style={styles.choiceAltText}>Enter VIN</Text></Pressable>
            <Pressable style={styles.choiceAlt} onPress={() => { setError(''); setStep('manual'); }}><Text style={styles.choiceAltText}>Enter year, make, and model</Text></Pressable>
          </>
        ) : null}

        {step === 'plate' || step === 'barcode' ? (
          <>
            <Text style={styles.heading}>{step === 'plate' ? 'VIN plate' : 'VIN barcode'}</Text>
            <CameraView
              ref={camera}
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['code39', 'code128', 'code93', 'qr', 'datamatrix', 'pdf417'] }}
              onBarcodeScanned={step === 'barcode' ? (result) => {
                const found = extractVin(result.data);
                if (!found || locked.current) return;
                locked.current = true;
                void useVin(found);
              } : undefined}
            />
            {step === 'plate' ? (
              <Pressable style={styles.choice} disabled={reading} onPress={() => void capturePlate()}>
                {reading ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.choiceText}>Read this plate</Text>}
              </Pressable>
            ) : (
              <Text style={styles.help}>{reading ? 'Looking up that VIN...' : 'Point the camera at the barcode.'}</Text>
            )}
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

        {step === 'manual' || step === 'review' ? (
          <>
            <Text style={styles.heading}>{step === 'review' ? 'Check this vehicle' : 'Enter the machine'}</Text>
            <Text style={styles.label}>Nickname</Text>
            <TextInput style={styles.input} placeholder="e.g. Dad's truck" placeholderTextColor={theme.muted} value={nickname} onChangeText={setNickname} />
            <Text style={styles.label}>Year, make, model</Text>
            <TextInput style={styles.input} placeholder="e.g. 2004 Dodge 3500" placeholderTextColor={theme.muted} value={yearMakeModel} onChangeText={setYearMakeModel} />
            <Text style={styles.label}>VIN, if it has one</Text>
            <TextInput style={styles.input} placeholder="Optional" placeholderTextColor={theme.muted} value={vin} onChangeText={setVin} autoCapitalize="characters" />
            <Pressable style={styles.choice} disabled={saving} onPress={() => void saveVehicle()}>
              {saving ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.choiceText}>Save vehicle</Text>}
            </Pressable>
          </>
        ) : null}

        {step === 'delete' ? (
          <>
            <Text style={styles.heading}>Delete a vehicle</Text>
            {vehicles.length === 0 ? <Text style={styles.help}>No machines saved yet.</Text> : null}
            {vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.machine}>{vehicle.nickname || vehicle.yearMakeModel || 'Untitled'}</Text>
                  {vehicle.yearMakeModel && vehicle.nickname ? <Text style={styles.meta}>{vehicle.yearMakeModel}</Text> : null}
                  {vehicle.vin ? <Text style={styles.meta}>VIN {vehicle.vin}</Text> : null}
                </View>
                <Pressable style={styles.delete} onPress={() => { setError(''); setWarnId(vehicle.id); }}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Modal visible={!!warned && !confirming} transparent animationType="fade" onRequestClose={() => setWarnId('')}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
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
          <View style={styles.modalCard}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  heading: { fontSize: 32, fontWeight: '800', color: theme.text, marginBottom: 8 },
  back: { color: theme.accent, fontWeight: '800', fontSize: 16, marginBottom: 12 },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  label: { color: theme.text, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: theme.input, color: theme.text, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  choice: { backgroundColor: theme.action, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  choiceText: { color: theme.ink, fontWeight: '800', fontSize: 17 },
  choiceAlt: { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.line, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  choiceAltText: { color: theme.text, fontWeight: '800', fontSize: 17 },
  deleteChoice: { backgroundColor: theme.danger, borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  deleteChoiceText: { color: theme.white, fontWeight: '800', fontSize: 17 },
  camera: { width: '100%', height: 360, borderRadius: 16, overflow: 'hidden', marginTop: 12, backgroundColor: '#111' },
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
  modalTitle: { fontWeight: '800', color: theme.text, fontSize: 20 },
});
