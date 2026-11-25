import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { currentOwnerId } from '../account';
import { PLAN_SIZES, savePlanLimit, startDowngradeHold, watchPlanLimit } from '../plan';
import { theme } from '../theme';

type Machine = { id: string; nickname?: string; yearMakeModel?: string };

export default function PlanScreen() {
  const [limit, setLimit] = useState<number | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    const stop = watchPlanLimit(setLimit);
    void getDocs(query(collection(db, 'vehicles'), where('ownerId', '==', currentOwnerId())))
      .then((snap) => setMachines(snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Machine)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load machines'));
    return stop;
  }, []);

  const chooseLimit = async (next: number | null) => {
    setError('');
    setSaved('');
    setPending(null);
    if (next != null && machines.length > next && (limit == null || next < limit)) {
      const extra = machines.length - next;
      setPending(next);
      setError(`This plan covers ${next} machines. You have ${machines.length}. Delete ${extra} ${extra === 1 ? 'machine' : 'machines'} before the smaller plan starts. New rentals keep working until that smaller plan starts. If it starts and the extra machines are still here, new rentals stop until you delete down to ${next}. You can still open old cards, save any you need, and check in a machine that is already out. Deleting erases that machine's cards, photos, and video.`);
      return;
    }
    setBusy(true);
    try {
      await savePlanLimit(next);
      setSaved(next ? `This test plan covers ${next} machines.` : 'No limit.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan');
    } finally {
      setBusy(false);
    }
  };

  const startSmaller = async () => {
    if (!pending) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await startDowngradeHold(pending);
      setSaved(`The ${pending} machine plan has started. You still have ${machines.length}. New rentals are stopped until you delete down to ${pending}.`);
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the smaller plan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Plan test</Text>
      <Text style={styles.body}>Billing is not on. These buttons do not charge anyone. A plan covers that many machines. Adding one more than the plan is blocked, and the other rentals keep working. New rentals stop only after a smaller plan starts and the extra machines are still there.</Text>
      <Text style={styles.current}>{limit ? `Test plan: up to ${limit} machines` : 'Test plan: no limit'} · You have {machines.length}</Text>
      <View style={styles.row}>
        {PLAN_SIZES.map((size) => (
          <Pressable key={size} style={[styles.choice, limit === size && styles.choiceOn]} disabled={busy} onPress={() => void chooseLimit(size)}>
            <Text style={styles.choiceText}>Up to {size}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.choice, !limit && styles.choiceOn]} disabled={busy} onPress={() => void chooseLimit(null)}>
          <Text style={styles.choiceText}>No limit</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {pending ? (
        <Pressable style={styles.hold} disabled={busy} onPress={() => void startSmaller()}>
          <Text style={styles.holdText}>Test: smaller plan has started</Text>
        </Pressable>
      ) : null}
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}
      <Text style={styles.heading}>Your machines</Text>
      <Text style={styles.body}>Delete extra machines from Add/Delete Vehicle. The delete step warns you that the cards, photos, and video are erased.</Text>
      {machines.map((item) => (
        <View key={item.id} style={styles.machine}>
          <Text style={styles.machineName}>{item.nickname || item.yearMakeModel || 'Untitled'}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 22, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: theme.text, fontSize: 32, fontWeight: '800' },
  current: { color: theme.text, fontWeight: '800', marginTop: 16 },
  heading: { color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 22 },
  body: { color: theme.muted, fontSize: 16, lineHeight: 22, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  choice: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  choiceOn: { borderColor: theme.accent, borderWidth: 2 },
  choiceText: { color: theme.text, fontWeight: '800' },
  machine: { marginTop: 10, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.line, padding: 14 },
  machineName: { color: theme.text, fontWeight: '800' },
  error: { color: theme.danger, marginTop: 14, lineHeight: 20 },
  hold: { marginTop: 12, backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignSelf: 'flex-start' },
  holdText: { color: '#fff', fontWeight: '800' },
  saved: { color: theme.text, marginTop: 14, lineHeight: 20 },
});
