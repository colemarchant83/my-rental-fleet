import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
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
  const [checkoutSide, setCheckoutSide] = useState<InspectionSide | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vehicleId) return;
    void getDoc(doc(db, 'vehicles', vehicleId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setNickname(String(data.nickname || ''));
      if (mode === 'checkin' && data.renterName) setRenterName(String(data.renterName));
    }).catch(() => undefined);
    if (mode === 'checkin') {
      void openRentalFor(vehicleId).then((rental) => {
        if (!rental) return;
        setOpenId(rental.localId);
        if (rental.renterName) setRenterName(rental.renterName);
        setCheckoutSide(rental.checkout);
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
    if (!side.miles.trim() && !side.hours.trim()) {
      setError('Enter the miles or the engine hours before saving.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const openCard = (localId: string) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.assign(`/rental-history?localId=${encodeURIComponent(localId)}`);
          return;
        }
        router.replace({ pathname: '/rental-history', params: { localId } });
      };
      if (mode === 'checkout') {
        const rental = await saveCheckout(vehicleId, renterName, side);
        openCard(rental.localId);
        return;
      }
      if (!openId) {
        const created = await saveCheckout(vehicleId, renterName, freshInspection());
        await saveCheckin(created.localId, side);
        openCard(created.localId);
        return;
      }
      await saveCheckin(openId, side);
      openCard(openId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{mode === 'checkout' ? 'Pre-rental inspection' : 'Return inspection'}</Text>
      {nickname ? <Text style={styles.machine}>{nickname}</Text> : null}
      <InspectionForm
        mode={mode}
        renterName={renterName}
        renterLocked={mode === 'checkin' && !!openId}
        onRenterName={setRenterName}
        side={side}
        checkout={mode === 'checkin' ? checkoutSide ?? undefined : undefined}
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
