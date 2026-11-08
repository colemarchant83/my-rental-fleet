import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BackLink } from '../components/back-link';
import { InspectionForm, freshInspection } from '../components/inspection-form';
import { emptySide, openRentalFor, saveCheckin, saveCheckout, type InspectionSide } from '../fleet-store';
import { theme } from '../theme';

export default function InspectionScreen() {
  const params = useLocalSearchParams<{ vehicleId?: string; type?: string }>();
  const vehicleId = params.vehicleId;
  const mode = params.type === 'checkin' ? 'checkin' : 'checkout';
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [renterName, setRenterName] = useState('');
  const [side, setSide] = useState<InspectionSide>(emptySide());
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vehicleId) return;
    void getDoc(doc(db, 'vehicles', vehicleId)).then((snap) => {
      if (snap.exists()) setNickname(String(snap.data().nickname || ''));
    }).catch(() => undefined);
    if (mode === 'checkin') {
      void openRentalFor(vehicleId).then((rental) => {
        if (!rental) return;
        setOpenId(rental.localId);
        setRenterName(rental.renterName);
      });
    }
  }, [vehicleId, mode]);

  const save = async () => {
    if (!vehicleId) {
      setError('Missing machine');
      return;
    }
    if (!renterName.trim()) {
      setError('Enter the renter name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (mode === 'checkout') {
        const rental = await saveCheckout(vehicleId, renterName, side);
        router.replace({ pathname: '/rental-history', params: { localId: rental.localId } });
        return;
      }
      if (!openId) {
        const created = await saveCheckout(vehicleId, renterName, freshInspection());
        await saveCheckin(created.localId, side);
        router.replace({ pathname: '/rental-history', params: { localId: created.localId } });
        return;
      }
      await saveCheckin(openId, side);
      router.replace({ pathname: '/rental-history', params: { localId: openId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackLink />
      <Text style={styles.heading}>{mode === 'checkout' ? 'Pre-rental inspection' : 'Return inspection'}</Text>
      {nickname ? <Text style={styles.machine}>{nickname}</Text> : null}
      <InspectionForm
        mode={mode}
        renterName={renterName}
        renterLocked={mode === 'checkin' && !!openId}
        onRenterName={setRenterName}
        side={side}
        onChange={setSide}
        onSave={() => void save()}
        saving={saving}
        error={error}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 48 },
  heading: { fontSize: 28, fontWeight: '800', color: theme.text },
  machine: { color: theme.accent, fontWeight: '800', marginTop: 4, marginBottom: 8 },
});
